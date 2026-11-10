import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CashMovement, CashMovementDocument, CashMovementType } from './cash.schema';
import { Shift, ShiftDocument, ShiftStatus } from '../shifts/shift.schema';

@Injectable()
export class CashService {
  constructor(
    @InjectModel(CashMovement.name) private cashMovementModel: Model<CashMovementDocument>,
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
  ) {}

  async create(data: {
    shiftId: Types.ObjectId;
    type: CashMovementType;
    amount: number; // já vem em centavos
    reason: string;
    userId: Types.ObjectId;
  }) {
    const shift = await this.shiftModel.findById(data.shiftId);
    if (!shift) throw new NotFoundException('Turno não encontrado');
    if (shift.status !== ShiftStatus.ABERTO) {
      throw new BadRequestException('Turno não está aberto');
    }

    const movement = new this.cashMovementModel({
      shift: data.shiftId,
      type: data.type,
      amountCents: data.amount,
      reason: data.reason,
      user: data.userId,
    });

    return movement.save();
  }

  async findByShift(shiftId: Types.ObjectId) {
    return this.cashMovementModel
      .find({ shift: shiftId })
      .sort({ createdAt: -1 })
      .populate('user', 'name')
      .lean();
  }

  async getShiftTotals(shiftId: Types.ObjectId) {
    const movements = await this.cashMovementModel.find({ shift: shiftId }).lean();
    let reforcos = 0;
    let retiradas = 0;
    for (const m of movements) {
      if (m.type === CashMovementType.REFORCO) reforcos += m.amountCents;
      else if (m.type === CashMovementType.RETIRADA) retiradas += m.amountCents;
    }
    return { reforcos, retiradas };
  }
}