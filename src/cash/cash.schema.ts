import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CashMovementDocument = CashMovement & Document;

export enum CashMovementType {
  REFORCO = 'reforco',
  RETIRADA = 'retirada',
}

@Schema({ timestamps: true })
export class CashMovement {
  @Prop({ type: Types.ObjectId, ref: 'Shift', required: true, index: true })
  shift: Types.ObjectId;

  @Prop({ enum: CashMovementType, required: true })
  type: CashMovementType;

  @Prop({ required: true, min: 1 })
  amountCents: number;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;
}

export const CashMovementSchema = SchemaFactory.createForClass(CashMovement);