import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentMethod, PaymentStatus, CardType } from './payment.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/order.schema';
import { Shift, ShiftDocument } from '../shifts/shift.schema';
import { AuditLog, AuditLogDocument } from '../common/audit/audit.schema';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async create(data: {
    orderId: Types.ObjectId;
    shiftId: Types.ObjectId;
    method: PaymentMethod;
    amountCents: number;
    receivedCents?: number;
    cardType?: CardType;
    reference?: string;
    createdBy: Types.ObjectId;
  }) {
    const order = await this.orderModel.findById(data.orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.AGUARDANDO_PAGAMENTO && order.status !== OrderStatus.EM_EDICAO) {
      throw new BadRequestException('Pedido não está aguardando pagamento');
    }

    // Verificar se já existe pagamento pendente/confirmado para este pedido
    const existing = await this.paymentModel.findOne({
      order: data.orderId,
      status: { $in: [PaymentStatus.PENDENTE, PaymentStatus.CONFIRMADO] },
    });
    if (existing) throw new ConflictException('Já existe pagamento pendente ou confirmado para este pedido');

    let changeCents = 0;
    if (data.method === PaymentMethod.DINHEIRO) {
      if (!data.receivedCents || data.receivedCents < data.amountCents) {
        throw new BadRequestException('Valor recebido insuficiente');
      }
      changeCents = data.receivedCents - data.amountCents;
    }

    const payment = new this.paymentModel({
      order: data.orderId,
      shift: data.shiftId,
      method: data.method,
      cardType: data.cardType,
      amountCents: data.amountCents,
      receivedCents: data.receivedCents || data.amountCents,
      changeCents,
      status: PaymentStatus.PENDENTE,
      reference: data.reference,
    });

    await payment.save();
    await this.logAudit('payment.created', 'Payment', payment._id, data.createdBy, {
      order: data.orderId,
      method: data.method,
      amountCents: data.amountCents,
    });

    return payment;
  }

  async confirm(paymentId: string, userId: Types.ObjectId) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status === PaymentStatus.CONFIRMADO) {
      throw new BadRequestException('Pagamento já confirmado');
    }
    if (payment.status === PaymentStatus.NAO_CONFIRMADO) {
      throw new BadRequestException('Pagamento marcado como não confirmado');
    }

    payment.status = PaymentStatus.CONFIRMADO;
    payment.confirmedBy = userId;
    payment.confirmedAt = new Date();
    await payment.save();

    await this.logAudit('payment.confirmed', 'Payment', payment._id, userId, {
      order: payment.order,
      method: payment.method,
    });

    // Com o pagamento confirmado, libera o pedido (pago -> preparo/entrega).
    try {
      await this.ordersService.confirmPayment(String(payment.order), userId);
    } catch (error) {
      // Pagamento parcial ou pedido em outro status: segue o fluxo normal.
      if (!(error instanceof BadRequestException)) throw error;
    }

    return payment;
  }

  async reject(paymentId: string, userId: Types.ObjectId, reason: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status === PaymentStatus.CONFIRMADO) {
      throw new BadRequestException('Não pode rejeitar pagamento já confirmado');
    }

    payment.status = PaymentStatus.NAO_CONFIRMADO;
    payment.failedReason = reason;
    await payment.save();

    await this.logAudit('payment.rejected', 'Payment', payment._id, userId, {
      order: payment.order,
      reason,
    });

    return payment;
  }

  async findByOrder(orderId: Types.ObjectId) {
    return this.paymentModel.find({ order: orderId }).sort({ createdAt: -1 }).lean();
  }

  async findByShift(shiftId: Types.ObjectId) {
    return this.paymentModel.find({ shift: shiftId }).populate('order').sort({ createdAt: -1 }).lean();
  }

  async getShiftSummary(shiftId: Types.ObjectId) {
    const payments = await this.paymentModel.find({ shift: shiftId, status: PaymentStatus.CONFIRMADO }).lean();
    
    const summary = {
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      cartaoDebito: 0,
      cartaoCredito: 0,
      total: 0,
    };

    for (const p of payments) {
      summary.total += p.amountCents;
      if (p.method === PaymentMethod.DINHEIRO) summary.dinheiro += p.amountCents;
      else if (p.method === PaymentMethod.PIX) summary.pix += p.amountCents;
      else if (p.method === PaymentMethod.CARTAO) {
        summary.cartao += p.amountCents;
        if (p.cardType === CardType.DEBITO) summary.cartaoDebito += p.amountCents;
        else if (p.cardType === CardType.CREDITO) summary.cartaoCredito += p.amountCents;
      }
    }

    return summary;
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