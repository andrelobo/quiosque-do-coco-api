import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductsService } from './products.service';
import { StockMovementType } from '../stock/stock.schema';

describe('ProductsService.adjustStock', () => {
  const userId = new Types.ObjectId();
  let productModel: any;
  let stockMovementModel: any;
  let auditService: any;
  let service: ProductsService;

  const makeProduct = (overrides: Record<string, any> = {}) => ({
    _id: new Types.ObjectId(),
    name: 'Pão de Queijo',
    stockQty: 10,
    trackStock: true,
    ...overrides,
  });

  beforeEach(() => {
    productModel = {
      findById: vi.fn(),
      findOneAndUpdate: vi.fn(),
    };
    stockMovementModel = { create: vi.fn().mockResolvedValue({}) };
    auditService = { log: vi.fn().mockResolvedValue({}) };
    service = new ProductsService(productModel, stockMovementModel, auditService);
  });

  it('aplica o ajuste e registra movimento + auditoria', async () => {
    const product = makeProduct();
    productModel.findById.mockResolvedValue(product);
    productModel.findOneAndUpdate.mockResolvedValue({ ...product, stockQty: 15 });

    const result = await service.adjustStock(product._id.toString(), 5, 'Reposição', userId);

    expect(result.stockQty).toBe(15);
    expect(productModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: product._id.toString(), trackStock: true }),
      { $inc: { stockQty: 5 } },
      { new: true },
    );
    expect(stockMovementModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: product._id,
        type: StockMovementType.AJUSTE,
        qty: 5,
        balanceAfter: 15,
        reason: 'Reposição',
        user: userId,
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'product.stock.adjusted',
        entity: 'Product',
        entityId: product._id,
        userId,
        justification: 'Reposição',
        meta: expect.objectContaining({ qty: 5, previousQty: 10, balanceAfter: 15 }),
      }),
    );
  });

  it.each([0, 1.5])('rejeita quantidade inválida (%s)', async (qty) => {
    await expect(service.adjustStock('id', qty, 'Teste', userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(productModel.findById).not.toHaveBeenCalled();
  });

  it('rejeita motivo vazio', async () => {
    await expect(service.adjustStock('id', 1, '   ', userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita produto inexistente', async () => {
    productModel.findById.mockResolvedValue(null);
    await expect(service.adjustStock('id', 1, 'Teste', userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejeita produto que não controla estoque', async () => {
    productModel.findById.mockResolvedValue(makeProduct({ trackStock: false }));
    await expect(service.adjustStock('id', 1, 'Teste', userId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('impede saldo negativo e não grava movimento', async () => {
    const product = makeProduct({ stockQty: 3 });
    productModel.findById
      .mockResolvedValueOnce(product)
      .mockReturnValueOnce({ lean: () => Promise.resolve({ stockQty: 3 }) });
    productModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(service.adjustStock(product._id.toString(), -5, 'Perda', userId)).rejects.toThrow(
      /estoque negativo/i,
    );
    expect(stockMovementModel.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
