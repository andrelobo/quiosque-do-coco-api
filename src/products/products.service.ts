import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductCategory } from './product.schema';
import { StockMovement, StockMovementDocument, StockMovementType } from '../stock/stock.schema';
import { AuditService } from '../common/audit/audit.service';

interface ProductWithVirtual extends ProductDocument {
  availableQty: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
    private readonly auditService: AuditService,
  ) {}

  async create(data: {
    name: string;
    category: ProductCategory;
    price: number; // já vem em centavos (pipe converte)
    unit?: string;
    requiresPrep?: boolean;
    trackStock?: boolean;
    stockQty?: number;
  }) {
    const existing = await this.productModel.findOne({ name: data.name });
    if (existing) throw new ConflictException('Produto já existe');
    const product = new this.productModel({
      ...data,
      priceCents: data.price, // mapeia para o campo do schema
    });
    return product.save();
  }

  // Os .lean() não trazem o virtual availableQty, então calculamos aqui.
  // Também converte _id (ObjectId) para id (string) e REMOVE _id para evitar React error #31
  private withAvailable<T extends { stockQty?: number; reservedQty?: number; _id?: any }>(product: T) {
    const { _id, ...rest } = product;
    return {
      ...rest,
      id: _id?.toString?.() ?? _id,
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

  async update(id: string, data: Partial<{
    name: string;
    category: ProductCategory;
    price: number; // já vem em centavos
    unit: string;
    active: boolean;
    requiresPrep: boolean;
    trackStock: boolean;
    stockQty: number;
  }>) {
    const updateData: any = { ...data };
    if (data.price !== undefined) {
      updateData.priceCents = data.price;
      delete updateData.price;
    }
    const product = await this.productModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async setActive(id: string, active: boolean) {
    return this.update(id, { active });
  }

  async adjustStock(id: string, qty: number, reason: string, userId: Types.ObjectId) {
    if (!Number.isInteger(qty) || qty === 0) {
      throw new BadRequestException('Quantidade do ajuste deve ser um número inteiro diferente de zero');
    }
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new BadRequestException('Motivo do ajuste é obrigatório');

    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produto não encontrado');
    if (!product.trackStock) throw new ConflictException('Produto não controla estoque');

    const previousQty = product.stockQty;

    // Atualização condicional: só grava se o saldo resultante continuar >= 0.
    // Evita lost update se outro ajuste/entrega mexer no estoque ao mesmo tempo.
    const updated = await this.productModel.findOneAndUpdate(
      {
        _id: id,
        trackStock: true,
        $expr: { $gte: [{ $add: ['$stockQty', qty] }, 0] },
      },
      { $inc: { stockQty: qty } },
      { new: true },
    );
    if (!updated) {
      const current = await this.productModel.findById(id).lean();
      throw new ConflictException(
        `Ajuste deixaria o estoque negativo (saldo atual: ${current?.stockQty ?? previousQty})`,
      );
    }

    await this.stockMovementModel.create({
      product: updated._id,
      type: StockMovementType.AJUSTE,
      qty,
      balanceAfter: updated.stockQty,
      reason: trimmedReason,
      user: userId,
    });

    await this.auditService.log({
      action: 'product.stock.adjusted',
      entity: 'Product',
      entityId: updated._id,
      userId,
      justification: trimmedReason,
      meta: {
        productName: updated.name,
        qty,
        previousQty,
        balanceAfter: updated.stockQty,
        reason: trimmedReason,
      },
    });

    return updated;
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