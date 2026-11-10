import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  EM_EDICAO = 'em_edicao',
  AGUARDANDO_PAGAMENTO = 'aguardando_pagamento',
  PAGO = 'pago',
  EM_PREPARO = 'em_preparo',
  PRONTO = 'pronto',
  ENTREGUE = 'entregue',
  CANCELADO = 'cancelado',
}

export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  unitPriceCents: number;

  @Prop({ required: true, min: 1 })
  qty: number;

  @Prop({ trim: true })
  note?: string;

  @Prop({ default: false })
  trackStock: boolean;

  @Prop({ default: false })
  requiresPrep: boolean;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  code: number;

  @Prop({ required: true })
  dayKey: string;

  @Prop({ type: Types.ObjectId, ref: 'Shift', required: true })
  shift: Types.ObjectId;

  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  totalCents: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.EM_EDICAO })
  status: OrderStatus;

  @Prop({ trim: true })
  pickupName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop()
  paidAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deliveredBy: Types.ObjectId;

  @Prop()
  deliveredAt: Date;

  @Prop()
  cancelReason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy: Types.ObjectId;

  @Prop()
  cancelledAt: Date;

  @Prop({ default: false })
  stockReserved: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ dayKey: 1, code: 1 }, { unique: true });
OrderSchema.index({ shift: 1, status: 1 });