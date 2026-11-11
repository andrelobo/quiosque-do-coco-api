import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/order.schema';
import { Payment, PaymentDocument, PaymentStatus, PaymentMethod, CardType } from '../payments/payment.schema';
import { Refund, RefundDocument } from '../refunds/refund.schema';
import { Shift, ShiftDocument, ShiftStatus } from '../shifts/shift.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { StockMovement, StockMovementDocument, StockMovementType } from '../stock/stock.schema';
import { CashMovement, CashMovementDocument, CashMovementType } from '../cash/cash.schema';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name) private refundModel: Model<RefundDocument>,
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(CashMovement.name) private cashMovementModel: Model<CashMovementDocument>,
  ) {}

  private getDateRange(start?: string, end?: string): DateRange {
    const startDate = start ? new Date(start) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = end ? new Date(end) : new Date();
    endDate.setHours(23, 59, 59, 999);
    return { start: startDate, end: endDate };
  }

  // 1. Vendas por período e turno
  async salesByPeriodAndShift(start?: string, end?: string) {
    const { start: startDate, end: endDate } = this.getDateRange(start, end);
    
    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: { $ne: OrderStatus.CANCELADO } } },
      {
        $lookup: { from: 'shifts', localField: 'shift', foreignField: '_id', as: 'shiftInfo' },
      },
      { $unwind: '$shiftInfo' },
      {
        $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, shift: '$shiftInfo.number' },
          orderCount: { $sum: 1 },
          itemsSold: { $sum: { $sum: '$items.qty' } },
          totalValue: { $sum: '$totalCents' },
        },
      },
      { $sort: { '_id.date': 1, '_id.shift': 1 } },
    ];
    return this.orderModel.aggregate(pipeline);
  }

  // 2. Vendas por produto
  async salesByProduct(start?: string, end?: string) {
    const { start: startDate, end: endDate } = this.getDateRange(start, end);
    
    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: { $ne: OrderStatus.CANCELADO } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          qty: { $sum: '$items.qty' },
          totalValue: { $sum: { $multiply: ['$items.unitPriceCents', '$items.qty'] } },
        },
      },
      { $sort: { totalValue: -1 } },
    ];
    return this.orderModel.aggregate(pipeline);
  }

  // 3. Pagamentos por modalidade
  async paymentsByMethod(start?: string, end?: string) {
    const { start: startDate, end: endDate } = this.getDateRange(start, end);
    
    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: PaymentStatus.CONFIRMADO } },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalValue: { $sum: '$amountCents' },
        },
      },
    ];
    return this.paymentModel.aggregate(pipeline);
  }

  // 4. Caixa: valor esperado, contado, diferença, reforços, retiradas
  async cashSummary(shiftId: string) {
    const shift = await this.shiftModel.findById(shiftId).lean();
    if (!shift) throw new Error('Turno não encontrado');

    // Pagamentos confirmados em dinheiro
    const cashPayments = await this.paymentModel.aggregate([
      { $match: { shift: new Types.ObjectId(shiftId), method: PaymentMethod.DINHEIRO, status: PaymentStatus.CONFIRMADO } },
      { $group: { _id: null, total: { $sum: '$amountCents' }, received: { $sum: '$receivedCents' }, change: { $sum: '$changeCents' } } },
    ]);
    const cashReceived = cashPayments[0]?.total || 0;

    // Devoluções em dinheiro concluídas
    const cashRefunds = await this.refundModel.aggregate([
      { $match: { shift: new Types.ObjectId(shiftId), method: 'dinheiro', status: 'concluida' } },
      { $group: { _id: null, total: { $sum: '$amountCents' } } },
    ]);
    const cashRefunded = cashRefunds[0]?.total || 0;

    // Reforços e retiradas
    const cashMovements = await this.cashMovementModel.aggregate([
      { $match: { shift: new Types.ObjectId(shiftId) } },
      { $group: { _id: '$type', total: { $sum: '$amountCents' } } },
    ]);
    let reforcos = 0, retiradas = 0;
    for (const m of cashMovements) {
      if (m._id === CashMovementType.REFORCO) reforcos = m.total;
      else if (m._id === CashMovementType.RETIRADA) retiradas = m.total;
    }

    // Recebimentos por modalidade (Pix e cartão não entram no caixa físico).
    const byMethod = await this.paymentModel.aggregate([
      { $match: { shift: new Types.ObjectId(shiftId), status: PaymentStatus.CONFIRMADO } },
      {
        $group: {
          _id: { method: '$method', cardType: '$cardType' },
          total: { $sum: '$amountCents' },
        },
      },
    ]);
    let pix = 0;
    let card = 0;
    let cardDebit = 0;
    let cardCredit = 0;
    let totalSales = 0;
    for (const m of byMethod) {
      totalSales += m.total;
      if (m._id.method === PaymentMethod.PIX) {
        pix += m.total;
      } else if (m._id.method === PaymentMethod.CARTAO) {
        card += m.total;
        if (m._id.cardType === CardType.DEBITO) cardDebit += m.total;
        else if (m._id.cardType === CardType.CREDITO) cardCredit += m.total;
      }
    }

    const expected = shift.initialCashCents + cashReceived + reforcos - retiradas - cashRefunded;
    const counted = shift.countedCashCents || 0;
    const difference = counted - expected;

    return {
      shift: { number: shift.number, status: shift.status },
      initialCashCents: shift.initialCashCents,
      cashReceivedCents: cashReceived,
      cashRefundedCents: cashRefunded,
      reforcosCents: reforcos,
      retiradasCents: retiradas,
      pixCents: pix,
      cardCents: card,
      cardDebitCents: cardDebit,
      cardCreditCents: cardCredit,
      totalSalesCents: totalSales,
      expectedCashCents: expected,
      countedCashCents: counted,
      differenceCents: difference,
    };
  }

  // 5. Pedidos pendentes: pagos e ainda não entregues
  async pendingDelivery(shiftId?: string) {
    const filter: any = { status: { $in: [OrderStatus.PAGO, OrderStatus.EM_PREPARO, OrderStatus.PRONTO] } };
    if (shiftId) filter.shift = new Types.ObjectId(shiftId);
    return this.orderModel.find(filter).populate('items.product').populate('shift').sort({ createdAt: 1 }).lean();
  }

  // 6. Cancelamentos e devoluções
  async cancellationsAndRefunds(start?: string, end?: string) {
    const { start: startDate, end: endDate } = this.getDateRange(start, end);

    const cancelledOrders = await this.orderModel.find({
      status: OrderStatus.CANCELADO,
      cancelledAt: { $gte: startDate, $lte: endDate },
    }).populate('cancelledBy', 'name').lean();

    const refunds = await this.refundModel.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate('createdBy', 'name').populate('completedBy', 'name').populate('order').lean();

    return { cancelledOrders, refunds };
  }

  // 7. Estoque: entradas, entregas, reservas, perdas, ajustes, saldo
  async stockReport(productId?: string) {
    const match: any = {};
    if (productId) match.product = new Types.ObjectId(productId);

    const movements = await this.stockMovementModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalQty: { $sum: '$qty' },
        },
      },
    ]);

    const summary: Record<string, { count: number; totalQty: number }> = {};
    for (const m of movements) {
      summary[m._id] = { count: m.count, totalQty: m.totalQty };
    }

    // Saldo por produto
    const balancePipeline: PipelineStage[] = [
      { $match: match },
      { $sort: { product: 1, createdAt: 1 } },
      {
        $group: {
          _id: '$product',
          movements: { $push: { type: '$type', qty: '$qty', balanceAfter: '$balanceAfter', createdAt: '$createdAt' } },
        },
      },
      {
        $project: {
          product: '$_id',
          currentBalance: { $arrayElemAt: ['$movements.balanceAfter', -1] },
        },
      },
    ];
    const balances = await this.stockMovementModel.aggregate(balancePipeline);

    return { summary, balances };
  }
}