import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SOLD_ORDER_STATUSES } from '../orders/order.schema';
import { OrderStatus } from '../orders/order.schema';

describe('ReportsService — relatórios de venda', () => {
  let orderModel: any;
  let service: ReportsService;

  beforeEach(() => {
    orderModel = { aggregate: vi.fn().mockResolvedValue([]) };
    service = new ReportsService(
      orderModel,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  const firstPipeline = () => orderModel.aggregate.mock.calls[0][0];

  it('conta como venda apenas pedidos já pagos', async () => {
    await service.salesByPeriodAndShift('2026-11-16', '2026-11-16');

    const match = firstPipeline()[0].$match;
    expect(match.status).toEqual({ $in: SOLD_ORDER_STATUSES });
    expect(SOLD_ORDER_STATUSES).not.toContain(OrderStatus.EM_EDICAO);
    expect(SOLD_ORDER_STATUSES).not.toContain(OrderStatus.AGUARDANDO_PAGAMENTO);
    expect(SOLD_ORDER_STATUSES).not.toContain(OrderStatus.CANCELADO);
  });

  it('filtra o dia no fuso do negócio (03:00Z às 02:59:59.999Z do dia seguinte)', async () => {
    await service.salesByPeriodAndShift('2026-11-16', '2026-11-16');

    const { createdAt } = firstPipeline()[0].$match;
    expect(createdAt.$gte.toISOString()).toBe('2026-11-16T03:00:00.000Z');
    expect(createdAt.$lte.toISOString()).toBe('2026-11-17T02:59:59.999Z');
  });

  it('agrupa a data no fuso do negócio', async () => {
    await service.salesByPeriodAndShift('2026-11-16', '2026-11-16');

    const group = firstPipeline().find((stage: any) => stage.$group);
    expect(group.$group._id.date.$dateToString.timezone).toBe('America/Sao_Paulo');
  });

  it('aplica o mesmo filtro de vendas pagas no relatório por produto', async () => {
    await service.salesByProduct('2026-11-16', '2026-11-16');

    expect(firstPipeline()[0].$match.status).toEqual({ $in: SOLD_ORDER_STATUSES });
  });

  it('rejeita data em formato inválido com 400', async () => {
    await expect(service.salesByPeriodAndShift('16/11/2026')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita período com início depois do fim', async () => {
    await expect(
      service.salesByPeriodAndShift('2026-11-17', '2026-11-16'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
