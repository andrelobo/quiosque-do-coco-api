import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefundDocument = Refund & Document;

@Schema({ timestamps: true })
export class Refund {
  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true })
  payment: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shift', required: true, index: true })
  shift: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amountCents: number;

  @Prop({ enum: ['pendente', 'concluida'], default: 'pendente' })
  status: string;

  @Prop({ enum: ['dinheiro', 'pix', 'cartao'], required: true })
  method: string;

  @Prop()
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  completedBy: Types.ObjectId;

  @Prop()
  completedAt: Date;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);