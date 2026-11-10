import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus, OrderItem } from './order.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { Shift, ShiftDocument, ShiftStatus } from '../shifts/shift.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/payment.schema';
import { StockMovement, StockMovementDocument, StockMovementType } from '../stock/stock.schema';
import { AuditLog, AuditLogDocument } from '../common/audit/audit.schema';

interface ProductWithVirtual extends ProductDocument {
  availableQty: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  private generateDayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // O código do pedido é único por dia (índice dayKey + code) e não por turno:
  // se fosse por turno, o 2º turno do dia colidiria com o 1º.
  async getNextCode(): Promise<number> {
    const dayKey = this.generateDayKey();
    const last = await this.orderModel
      .findOne({ dayKey })
      .sort({ code: -1 })
      .select('code')
      .lean();
    return (last?.code ?? 0) + 1;
  }

  async create(data: {
    shiftId: Types.ObjectId;
    items: Array<{
      productId: Types.ObjectId;
      qty: number;
      note?: string;
    }>;
    pickupName?: string;
    createdBy: Types.ObjectId;
  }) {
    const shift = await this.shiftModel.findById(data.shiftId);
    if (!shift || shift.status !== ShiftStatus.ABERTO) {
      throw new BadRequestException('Turno não está aberto');
    }

    // Validar produtos e calcular total
    const orderItems: OrderItem[] = [];
    let totalCents = 0;

    for (const item of data.items) {
      const product = await this.productModel.findById(item.productId);
      if (!product) throw new NotFoundException(`Produto ${item.productId} não encontrado`);
      if (!product.active) throw new BadRequestException(`Produto ${product.name} está inativo`);
      
      // Verificar disponibilidade no turno
      const availability = shift.availability.find((a) => a.product.toString() === item.productId.toString());
      if (availability && !availability.available) {
        throw new BadRequestException(`Produto ${product.name} não está disponível neste turno`);
      }

      // Verificar estoque se controlado
      const productWithVirtual = product as ProductWithVirtual;
      if (product.trackStock && productWithVirtual.availableQty < item.qty) {
        throw new ConflictException(`Estoque insuficiente para ${product.name}. Disponível: ${productWithVirtual.availableQty}`);
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        unitPriceCents: product.priceCents,
        qty: item.qty,
        note: item.note,
        trackStock: product.trackStock,
        requiresPrep: product.requiresPrep,
      });
      totalCents += product.priceCents * item.qty;
    }

    const dayKey = this.generateDayKey();
    let code = await this.getNextCode();

    // Duas comandas simultâneas podem calcular o mesmo código: tenta de novo.
    let order!: OrderDocument;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      order = new this.orderModel({
        code,
        dayKey,
        shift: data.shiftId,
        items: orderItems,
        totalCents,
        status: OrderStatus.EM_EDICAO,
        pickupName: data.pickupName,
        createdBy: data.createdBy,
      });
      try {
        await order.save();
        break;
      } catch (error) {
        if ((error as any)?.code === 11000 && attempt < 4) {
          code += 1;
          continue;
        }
        throw error;
      }
    }
    await this.logAudit('order.created', 'Order', order._id, data.createdBy, { code, totalCents });
    return order.populate('items.product');
  }

  async findById(id: string) {
    const order = await this.orderModel.findById(id).populate('items.product').lean();
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  async findByShift(shiftId: Types.ObjectId, status?: OrderStatus) {
    const filter: any = { shift: shiftId };
    if (status) filter.status = status;
    return this.orderModel.find(filter).populate('items.product').sort({ createdAt: -1 }).lean();
  }

  async findAll(status?: OrderStatus, page = 1, limit = 10) {
    const filter: any = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.orderModel.find(filter).populate('items.product').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByCode(dayKey: string, code: number) {
    return this.orderModel.findOne({ dayKey, code }).populate('items.product').lean();
  }

  async updateItems(orderId: string, items: Array<{ productId: string; qty: number; note?: string }>, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.EM_EDICAO && order.status !== OrderStatus.AGUARDANDO_PAGAMENTO) {
      throw new BadRequestException('Pedido não pode mais ser editado');
    }

    const shift = await this.shiftModel.findById(order.shift);
    if (!shift || shift.status !== ShiftStatus.ABERTO) {
      throw new BadRequestException('Turno não está aberto');
    }

    // Validar e recalcular
    const orderItems: OrderItem[] = [];
    let totalCents = 0;

    for (const item of items) {
      const product = await this.productModel.findById(item.productId);
      if (!product) throw new NotFoundException(`Produto ${item.productId} não encontrado`);
      if (!product.active) throw new BadRequestException(`Produto ${product.name} está inativo`);
      
      const availability = shift.availability.find((a) => a.product.toString() === item.productId);
      if (availability && !availability.available) {
        throw new BadRequestException(`Produto ${product.name} não disponível neste turno`);
      }

      if (product.trackStock) {
        const productWithVirtual = product as ProductWithVirtual;
        if (productWithVirtual.availableQty < item.qty) {
          throw new ConflictException(`Estoque insuficiente para ${product.name}`);
        }
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        unitPriceCents: product.priceCents,
        qty: item.qty,
        note: item.note,
        trackStock: product.trackStock,
        requiresPrep: product.requiresPrep,
      });
      totalCents += product.priceCents * item.qty;
    }

    order.items = orderItems;
    order.totalCents = totalCents;
    order.status = OrderStatus.EM_EDICAO;
    await order.save();

    await this.logAudit('order.updated', 'Order', order._id, userId, { code: order.code, totalCents });
    return order.populate('items.product');
  }

  async submitForPayment(orderId: string, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.EM_EDICAO) {
      throw new BadRequestException('Pedido não está em edição');
    }
    if (order.items.length === 0) {
      throw new BadRequestException('Pedido sem itens');
    }

    // Reservar estoque
    for (const item of order.items) {
      if (item.trackStock) {
        const product = await this.productModel.findById(item.product);
        if (product && product.trackStock) {
        const productWithVirtual = product as ProductWithVirtual;
        if (productWithVirtual.availableQty < item.qty) {
          throw new ConflictException(`Estoque insuficiente para ${item.name}`);
        }
      }
        await this.productModel.findByIdAndUpdate(item.product, { $inc: { reservedQty: item.qty } });
        await this.createStockMovement({
          product: item.product,
          type: StockMovementType.RESERVA,
          qty: item.qty,
          order: order._id,
          reason: `Reserva para pedido ${order.code}`,
          user: userId,
        });
      }
    }

    order.status = OrderStatus.AGUARDANDO_PAGAMENTO;
    order.stockReserved = true;
    await order.save();

    await this.logAudit('order.submitted', 'Order', order._id, userId, { code: order.code });
    return order.populate('items.product');
  }

  async confirmPayment(orderId: string, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.AGUARDANDO_PAGAMENTO) {
      throw new BadRequestException('Pedido não está aguardando pagamento');
    }

    // Verificar se existe pagamento confirmado
    const payment = await this.paymentModel.findOne({ order: order._id, status: PaymentStatus.CONFIRMADO });
    if (!payment) throw new BadRequestException('Nenhum pagamento confirmado para este pedido');

    order.status = OrderStatus.PAGO;
    order.paidAt = new Date();
    await order.save();

    await this.logAudit('order.paid', 'Order', order._id, userId, { code: order.code });
    
    // Se não requer preparo, ir direto para entrega
    const requiresPrep = order.items.some((i) => i.requiresPrep);
    if (!requiresPrep) {
      order.status = OrderStatus.ENTREGUE;
      order.deliveredAt = new Date();
      order.deliveredBy = userId;
      await this.processDelivery(order, userId);
    } else {
      order.status = OrderStatus.EM_PREPARO;
    }
    await order.save();

    return order.populate('items.product');
  }

  async startPrep(orderId: string, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.PAGO && order.status !== OrderStatus.EM_PREPARO) {
      throw new BadRequestException('Pedido não pode entrar em preparo');
    }

    order.status = OrderStatus.EM_PREPARO;
    await order.save();
    await this.logAudit('order.prep_started', 'Order', order._id, userId, { code: order.code });
    return order;
  }

  async markReady(orderId: string, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.EM_PREPARO) {
      throw new BadRequestException('Pedido não está em preparo');
    }

    order.status = OrderStatus.PRONTO;
    await order.save();
    await this.logAudit('order.ready', 'Order', order._id, userId, { code: order.code });
    return order;
  }

  async deliver(orderId: string, userId: Types.ObjectId) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status === OrderStatus.ENTREGUE) {
      throw new BadRequestException('Pedido já entregue');
    }
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('Pedido cancelado não pode ser entregue');
    }

    return this.processDelivery(order, userId);
  }

  private async processDelivery(order: OrderDocument, userId: Types.ObjectId) {
    // Baixar estoque definitivo
    for (const item of order.items) {
      if (item.trackStock) {
        await this.productModel.findByIdAndUpdate(item.product, {
          $inc: { reservedQty: -item.qty, stockQty: -item.qty },
        });
        await this.createStockMovement({
          product: item.product,
          type: StockMovementType.SAIDA,
          qty: item.qty,
          order: order._id,
          reason: `Entrega do pedido ${order.code}`,
          user: userId,
        });
      }
    }

    order.status = OrderStatus.ENTREGUE;
    order.deliveredAt = new Date();
    order.deliveredBy = userId;
    order.stockReserved = false;
    await order.save();

    await this.logAudit('order.delivered', 'Order', order._id, userId, { code: order.code });
    return order.populate('items.product');
  }

  async cancel(orderId: string, userId: Types.ObjectId, reason: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('Pedido já cancelado');
    }
    if (order.status === OrderStatus.ENTREGUE) {
      throw new BadRequestException('Pedido entregue não pode ser cancelado diretamente');
    }

    // Liberar reserva de estoque se houver
    if (order.stockReserved) {
      for (const item of order.items) {
        if (item.trackStock) {
          await this.productModel.findByIdAndUpdate(item.product, { $inc: { reservedQty: -item.qty } });
          await this.createStockMovement({
            product: item.product,
            type: StockMovementType.LIBERACAO,
            qty: item.qty,
            order: order._id,
            reason: `Cancelamento do pedido ${order.code}: ${reason}`,
            user: userId,
          });
        }
      }
    }

    order.status = OrderStatus.CANCELADO;
    order.cancelReason = reason;
    order.cancelledBy = userId;
    order.cancelledAt = new Date();
    order.stockReserved = false;
    await order.save();

    await this.logAudit('order.cancelled', 'Order', order._id, userId, { code: order.code, reason });
    return order;
  }

  async getPendingDelivery(shiftId: Types.ObjectId) {
    return this.orderModel.find({
      shift: shiftId,
      status: { $in: [OrderStatus.PAGO, OrderStatus.EM_PREPARO, OrderStatus.PRONTO] },
    }).populate('items.product').sort({ createdAt: 1 }).lean();
  }

  private async createStockMovement(data: {
    product: Types.ObjectId;
    type: StockMovementType;
    qty: number;
    order?: Types.ObjectId;
    reason: string;
    user: Types.ObjectId;
  }) {
    const product = await this.productModel.findById(data.product);
    const movement = new this.stockMovementModel({
      ...data,
      balanceAfter: product?.stockQty || 0,
    });
    return movement.save();
  }

  private async logAudit(action: string, entity: string, entityId: Types.ObjectId, userId: Types.ObjectId, meta?: any) {
    const user = await this.orderModel.db.model('User').findById(userId);
    await this.auditLogModel.create({
      action,
      entity,
      entityId,
      userName: user?.name,
      user: userId,
      meta,
    });
  }
}