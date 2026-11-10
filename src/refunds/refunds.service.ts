import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Refund, RefundDocument } from './refund.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/payment.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/order.schema';
import { AuditLog, AuditLogDocument } from '../common/audit/audit.schema';

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel(Refund.name) private refundModel: Model<RefundDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(data: {
    paymentId: Types.ObjectId;
    orderId: Types.ObjectId;
    shiftId: Types.ObjectId;
    amount: number; // já vem em centavos
    method: string;
    reason: string;
    createdBy: Types.ObjectId;
  }) {
    const payment = await this.paymentModel.findById(data.paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status !== PaymentStatus.CONFIRMADO) {
      throw new BadRequestException('Só é possível devolver pagamentos confirmados');
    }
    if (data.amount > payment.amountCents) {
      throw new BadRequestException('Valor da devolução maior que o pagamento');
    }

    // Verificar se já existe devolução pendente/concluída para este pagamento
    const existing = await this.refundModel.findOne({
      payment: data.paymentId,
      status: { $in: ['pendente', 'concluida'] },
    });
    if (existing) throw new ConflictException('Já existe devolução para este pagamento');

    const refund = new this.refundModel({
      payment: data.paymentId,
      order: data.orderId,
      shift: data.shiftId,
      amountCents: data.amount,
      status: 'pendente',
      method: data.method,
      reason: data.reason,
      createdBy: data.createdBy,
    });

    await refund.save();
    await this.logAudit('refund.created', 'Refund', refund._id, data.createdBy, {
      payment: data.paymentId,
      amountCents: data.amount,
    });

    return refund;
  }

  async complete(refundId: string, userId: Types.ObjectId) {
    const refund = await this.refundModel.findById(refundId);
    if (!refund) throw new NotFoundException('Devolução não encontrada');
    if (refund.status === 'concluida') {
      throw new BadRequestException('Devolução já concluída');
    }

    refund.status = 'concluida';
    refund.completedBy = userId;
    refund.completedAt = new Date();
    await refund.save();

    await this.logAudit('refund.completed', 'Refund', refund._id, userId, {
      payment: refund.payment,
      amountCents: refund.amountCents,
    });

    return refund;
  }

  async findByOrder(orderId: Types.ObjectId) {
    return this.refundModel.find({ order: orderId }).sort({ createdAt: -1 }).lean();
  }

  async findByShift(shiftId: Types.ObjectId) {
    return this.refundModel.find({ shift: shiftId }).populate('order').sort({ createdAt: -1 }).lean();
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