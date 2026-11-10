import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Shift, ShiftDocument, ShiftStatus, ShiftAvailability } from './shift.schema';
import { Product, ProductDocument } from '../products/product.schema';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async getNextNumber(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const count = await this.shiftModel.countDocuments({
      openedAt: { $gte: today, $lt: tomorrow },
    });
    return count + 1;
  }

  async open(data: {
    openedBy: Types.ObjectId;
    initialCashCents: number;
    productIds: Types.ObjectId[];
  }) {
    const openShift = await this.shiftModel.findOne({ status: ShiftStatus.ABERTO });
    if (openShift) throw new ConflictException('Já existe um turno aberto');

    const number = await this.getNextNumber();
    const availability: ShiftAvailability[] = data.productIds.map((id) => ({
      product: id,
      available: true,
    }));

    const shift = new this.shiftModel({
      number,
      openedBy: data.openedBy,
      initialCashCents: data.initialCashCents,
      availability,
    });
    return shift.save();
  }

  async findCurrent() {
    return this.shiftModel.findOne({ status: ShiftStatus.ABERTO }).populate('availability.product').lean();
  }

  async findAll() {
    return this.shiftModel.find().sort({ openedAt: -1 }).lean();
  }

  async findById(id: string) {
    const shift = await this.shiftModel.findById(id).populate('availability.product').lean();
    if (!shift) throw new NotFoundException('Turno não encontrado');
    return shift;
  }

  async updateAvailability(shiftId: string, productId: Types.ObjectId, available: boolean) {
    const shift = await this.shiftModel.findById(shiftId);
    if (!shift) throw new NotFoundException('Turno não encontrado');
    if (shift.status !== ShiftStatus.ABERTO) throw new BadRequestException('Turno não está aberto');

    const existing = shift.availability.find((a) => a.product.toString() === productId.toString());
    if (existing) {
      existing.available = available;
    } else {
      shift.availability.push({ product: productId, available });
    }
    return shift.save();
  }

  async getAvailableProducts(shiftId: string) {
    const shift = await this.shiftModel.findById(shiftId).populate('availability.product').lean();
    if (!shift) throw new NotFoundException('Turno não encontrado');
    return shift.availability
      .filter((a) => a.available && a.product)
      .map((a) => a.product);
  }

  async close(data: {
    shiftId: string;
    closedBy: Types.ObjectId;
    countedCashCents: number;
    closingNotes?: string;
  }) {
    const shift = await this.shiftModel.findById(data.shiftId);
    if (!shift) throw new NotFoundException('Turno não encontrado');
    if (shift.status !== ShiftStatus.ABERTO) throw new BadRequestException('Turno já está fechado');

    // Calcular esperado
    // Será calculado no service de fechamento com base nos pagamentos
    shift.status = ShiftStatus.FECHADO;
    shift.closedBy = data.closedBy;
    shift.closedAt = new Date();
    shift.countedCashCents = data.countedCashCents;
    if (data.closingNotes) shift.closingNotes = data.closingNotes;
    
    return shift.save();
  }

  async setClosingCalculations(shiftId: string, expectedCashCents: number, differenceCents: number) {
    return this.shiftModel.findByIdAndUpdate(shiftId, { expectedCashCents, differenceCents }, { new: true });
  }
}