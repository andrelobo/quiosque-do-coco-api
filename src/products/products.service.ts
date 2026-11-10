import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductCategory } from './product.schema';

interface ProductWithVirtual extends ProductDocument {
  availableQty: number;
}

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private productModel: Model<ProductDocument>) {}

  async create(data: {
    name: string;
    category: ProductCategory;
    priceCents: number;
    unit?: string;
    requiresPrep?: boolean;
    trackStock?: boolean;
    stockQty?: number;
  }) {
    const existing = await this.productModel.findOne({ name: data.name });
    if (existing) throw new ConflictException('Produto já existe');
    const product = new this.productModel(data);
    return product.save();
  }

  // Os .lean() não trazem o virtual availableQty, então calculamos aqui.
  private withAvailable<T extends { stockQty?: number; reservedQty?: number }>(product: T) {
    return {
      ...product,
      availableQty: (product.stockQty ?? 0) - (product.reservedQty ?? 0),
    };
  }

  async findAll(includeInactive = false) {
    const filter = includeInactive ? {} : { active: true };
    const products = await this.productModel
      .find(filter)
      .sort({ category: 1, name: 1 })
      .lean();
    return products.map((product) => this.withAvailable(product));
  }

  async findById(id: string) {
    const product = await this.productModel.findById(id).lean();
    if (!product) throw new NotFoundException('Produto não encontrado');
    return this.withAvailable(product);
  }

  async findByCategory(category: ProductCategory) {
    const products = await this.productModel.find({ category, active: true }).lean();
    return products.map((product) => this.withAvailable(product));
  }

  async update(id: string, data: Partial<Product>) {
    const product = await this.productModel.findByIdAndUpdate(id, data, { new: true });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async setActive(id: string, active: boolean) {
    return this.update(id, { active });
  }

  async adjustStock(id: string, qty: number, reason: string, userId: Types.ObjectId) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    if (!product.trackStock) throw new ConflictException('Produto não controla estoque');
    
    const newQty = Math.max(0, product.stockQty + qty);
    product.stockQty = newQty;
    await product.save();
    
    return product;
  }

  async reserveStock(id: string, qty: number) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    if (!product.trackStock) throw new ConflictException('Produto não controla estoque');
    const productWithVirtual = product as ProductWithVirtual;
    if (productWithVirtual.availableQty < qty) throw new ConflictException('Estoque insuficiente');
    
    product.reservedQty += qty;
    await product.save();
    return product;
  }

  async releaseStock(id: string, qty: number) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    product.reservedQty = Math.max(0, product.reservedQty - qty);
    await product.save();
    return product;
  }

  async confirmDelivery(id: string, qty: number) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    product.reservedQty = Math.max(0, product.reservedQty - qty);
    product.stockQty = Math.max(0, product.stockQty - qty);
    await product.save();
    return product;
  }
}