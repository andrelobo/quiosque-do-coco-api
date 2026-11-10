import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
  DINHEIRO = 'dinheiro',
  PIX = 'pix',
  CARTAO = 'cartao',
}

export enum CardType {
  DEBITO = 'debito',
  CREDITO = 'credito',
}

export enum PaymentStatus {
  PENDENTE = 'pendente',
  CONFIRMADO = 'confirmado',
  NAO_CONFIRMADO = 'nao_confirmado',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shift', required: true, index: true })
  shift: Types.ObjectId;

  @Prop({ enum: PaymentMethod, required: true })
  method: PaymentMethod;

  @Prop({ enum: CardType, default: null })
  cardType: CardType;

  @Prop({ required: true, min: 0 })
  amountCents: number;

  @Prop({ default: 0 })
  receivedCents: number;

  @Prop({ default: 0 })
  changeCents: number;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDENTE })
  status: PaymentStatus;

  @Prop()
  reference: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmedBy: Types.ObjectId;

  @Prop()
  confirmedAt: Date;

  @Prop()
  failedReason: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ order: 1, status: 1 });