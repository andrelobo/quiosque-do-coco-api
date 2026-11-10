import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

export enum StockMovementType {
  ENTRADA = 'entrada',
  RESERVA = 'reserva',
  LIBERACAO = 'liberacao',
  SAIDA = 'saida',
  PERDA = 'perda',
  AJUSTE = 'ajuste',
}

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ enum: StockMovementType, required: true })
  type: StockMovementType;

  @Prop({ required: true })
  qty: number;

  @Prop()
  balanceAfter: number;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  order: Types.ObjectId;

  @Prop()
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);