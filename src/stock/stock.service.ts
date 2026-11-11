import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockMovement, StockMovementDocument } from './stock.schema';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
  ) {}

  async findByProduct(productId: Types.ObjectId, limit = 100) {
    return this.stockMovementModel
      .find({ product: productId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('order')
      .populate('user', 'name')
      .lean();
  }

  async findByOrder(orderId: Types.ObjectId) {
    return this.stockMovementModel
      .find({ order: orderId })
      .sort({ createdAt: -1 })
      .populate('user', 'name')
      .lean();
  }

  async findByShift(shiftId: Types.ObjectId) {
    // Buscar movimentos via orders do turno
    return this.stockMovementModel
      .find()
      .populate({
        path: 'order',
        match: { shift: shiftId },
        select: 'code',
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getProductBalance(productId: Types.ObjectId) {
    const movements = await this.stockMovementModel
      .find({ product: productId })
      .sort({ createdAt: 1 })
      .lean();

    let balance = 0;
    for (const m of movements) {
      if (m.type === 'entrada') balance += m.qty;
      else if (m.type === 'saida') balance -= m.qty;
      else if (m.type === 'perda') balance -= m.qty;
      else if (m.type === 'ajuste') balance = m.balanceAfter ?? balance;
    }
    return balance;
  }
}