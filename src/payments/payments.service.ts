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
    amount: number; // já vem em centavos
    received?: number; // já vem em centavos
    cardType?: CardType;
    reference?: string;
    createdBy: Types.ObjectId;
  }) {
    const order = await this.orderModel.findById(data.orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== OrderStatus.AGUARDANDO_PAGAMENTO) {
      throw new BadRequestException('Pedido precisa estar aguardando pagamento para receber um pagamento');
    }
    if (order.shift.toString() !== data.shiftId.toString()) {
      throw new BadRequestException('O turno do pagamento não corresponde ao turno do pedido');
    }
    // O valor é definido pelo pedido, nunca pelo cliente: impede cobrança a menor.
    if (data.amount !== order.totalCents) {
      throw new BadRequestException(
        `Valor do pagamento (${data.amount}) difere do total do pedido (${order.totalCents})`,
      );
    }
    if (data.method === PaymentMethod.CARTAO && !data.cardType) {
      throw new BadRequestException('Informe o tipo do cartão (débito ou crédito)');
    }

    const existing = await this.paymentModel.findOne({
      order: data.orderId,
      status: { $in: [PaymentStatus.PENDENTE, PaymentStatus.CONFIRMADO] },
    });
    if (existing) throw new ConflictException('Já existe pagamento pendente ou confirmado para este pedido');

    let received = data.amount;
    let change = 0;
    if (data.method === PaymentMethod.DINHEIRO) {
      if (data.received === undefined || data.received === null) {
        throw new BadRequestException('Informe o valor recebido em dinheiro');
      }
      if (data.received < data.amount) {
        throw new BadRequestException('Valor recebido insuficiente');
      }
      received = data.received;
      change = data.received - data.amount;
    }

    const payment = new this.paymentModel({
      order: data.orderId,
      shift: data.shiftId,
      method: data.method,
      cardType: data.method === PaymentMethod.CARTAO ? data.cardType : undefined,
      amountCents: data.amount,
      receivedCents: received,
      changeCents: change,
      status: PaymentStatus.PENDENTE,
      reference: data.reference,
    });

    await payment.save();
    await this.logAudit('payment.created', 'Payment', payment._id, data.createdBy, {
      order: data.orderId,
      method: data.method,
      amountCents: data.amount,
    });

    return payment;
  }

  // Delega a transição para o OrdersService, fonte única de verdade, que
  // confirma o pagamento e libera o pedido. Erros NÃO são mais engolidos:
  // se o pedido não puder ser liberado, a operação falha de forma explícita.
  async confirm(paymentId: string, userId: Types.ObjectId) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status === PaymentStatus.NAO_CONFIRMADO) {
      throw new BadRequestException('Pagamento marcado como não confirmado');
    }

    await this.ordersService.confirmPayment(String(payment.order), userId);

    return this.paymentModel.findById(paymentId);
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