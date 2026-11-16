import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersService } from './orders.service';

describe('OrdersService.findAll — busca', () => {
  let orderModel: any;
  let service: OrdersService;
  let query: any;

  beforeEach(() => {
    query = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    orderModel = {
      find: vi.fn().mockReturnValue(query),
      countDocuments: vi.fn().mockResolvedValue(0),
    };
    service = new OrdersService(
      orderModel,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  const filterUsed = () => orderModel.find.mock.calls[0][0];

  it('não usa $regex direto no campo numérico code (causava CastError/500)', async () => {
    await service.findAll(undefined, 1, 10, 'cafe');

    const filter = filterUsed();
    const directCode = filter.$or.find((cond: any) => 'code' in cond);
    expect(directCode).toBeUndefined();
    expect(filter.$or.some((cond: any) => cond.$expr?.$regexMatch)).toBe(true);
  });

  it('busca por nome do cliente, item do pedido e dia', async () => {
    await service.findAll(undefined, 1, 10, 'cafe');

    const filter = filterUsed();
    const keys = filter.$or.map((cond: any) => Object.keys(cond)[0]);
    expect(keys).toContain('pickupName');
    expect(keys).toContain('items.name');
    expect(keys).toContain('dayKey');
  });

  it('busca numérica casa o código exato (inclusive com #) e ignora o dayKey', async () => {
    await service.findAll(undefined, 1, 10, '#12');

    const filter = filterUsed();
    expect(filter.$or).toContainEqual({ code: 12 });
    expect(filter.$or.some((cond: any) => 'dayKey' in cond)).toBe(false);
  });

  it('não quebra com caractere especial', async () => {
    await service.findAll(undefined, 1, 10, '(');

    const pattern = filterUsed().$or.find((cond: any) => cond.pickupName).pickupName.$regex;
    expect(pattern).toBe('\\(');
  });

  it('combina busca com filtro de status', async () => {
    await service.findAll('aguardando_pagamento' as any, 1, 10, 'maria');

    expect(filterUsed().status).toBe('aguardando_pagamento');
    expect(filterUsed().$or).toBeDefined();
  });

  it('sem termo não adiciona $or e normaliza paginação', async () => {
    const result = await service.findAll(undefined, -3 as any, 999 as any, '   ');

    const filter = filterUsed();
    expect(filter.$or).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.totalPages).toBe(0);
  });
});
