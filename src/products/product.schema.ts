import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document & { availableQty: number };

export enum ProductCategory {
  COCO = 'coco',
  CAFE_DA_MANHA = 'cafe-da-manha',
  ALMOCO = 'almoco',
  PETISCOS = 'petiscos',
  DRINKS = 'drinks',
  OUTROS = 'outros',
}

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ enum: ProductCategory, default: ProductCategory.OUTROS })
  category: ProductCategory;

  @Prop({ required: true, min: 0 })
  priceCents: number;

  @Prop({ default: 'un', trim: true })
  unit: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: false })
  requiresPrep: boolean;

  @Prop({ default: false })
  trackStock: boolean;

  @Prop({ default: 0, min: 0 })
  stockQty: number;

  @Prop({ default: 0, min: 0 })
  reservedQty: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.virtual('availableQty').get(function (this: ProductDocument) {
  return this.stockQty - this.reservedQty;
});