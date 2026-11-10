import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShiftDocument = Shift & Document;

export enum ShiftStatus {
  ABERTO = 'aberto',
  FECHADO = 'fechado',
}

export class ShiftAvailability {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ default: true })
  available: boolean;
}

@Schema({ timestamps: true })
export class Shift {
  @Prop({ required: true })
  number: number;

  @Prop({ enum: ShiftStatus, default: ShiftStatus.ABERTO })
  status: ShiftStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  openedBy: Types.ObjectId;

  @Prop({ default: Date.now })
  openedAt: Date;

  @Prop({ default: 0, min: 0 })
  initialCashCents: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy: Types.ObjectId;

  @Prop()
  closedAt: Date;

  @Prop()
  countedCashCents: number;

  @Prop()
  expectedCashCents: number;

  @Prop()
  differenceCents: number;

  @Prop()
  closingNotes: string;

  @Prop({ type: [ShiftAvailability], default: [] })
  availability: ShiftAvailability[];
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);
ShiftSchema.index({ status: 1 });