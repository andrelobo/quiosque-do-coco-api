import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { OrderStatus } from './order.schema';
import { PaymentStatus, PaymentMethod } from '../payments/payment.schema';

describe('OrdersService.confirmPayment', () => {
  const userId = new Types.ObjectId();

  let orderModel: any;
  let paymentModel: any;
  let auditLogModel: any;
  let service: OrdersService;
  let order: any;
  let payment: any;

  const makeOrder = (overrides: Record<string, any> = {}) => {
    const doc: any = {
      _id: new Types.ObjectId(),
      code: 42,
      status: OrderStatus.AGUARDANDO_PAGAMENTO,
      items: [{ requiresPrep: false, qty: 1 }],
      paidAt: undefined,
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
    doc.populate = jest.fn().mockResolvedValue(doc);
    return doc;
  };

  beforeEach(() => {
    order = makeOrder();
    payment = {
      _id: new Types.ObjectId(),
      status: PaymentStatus.PENDENTE,
      method: PaymentMethod.DINHEIRO,
      save: jest.fn().mockResolvedValue(true),
    };

    orderModel = {
      findById: jest.fn().mockResolvedValue(order),
      db: {
        model: () => ({
          findById: () => ({ name: 'Administrador' }),
        }),
      },
    };
    paymentModel = { findOne: jest.fn().mockResolvedValue(payment) };
    auditLogModel = { create: jest.fn().mockResolvedValue({}) };

    service = new OrdersService(
      orderModel,
      {} as any,
      {} as any,
      paymentModel,
      {} as any,
      auditLogModel,
    );
  });

  it('sem preparo: confirma pagamento e libera o pedido como PRONTO', async () => {
    const result = await service.confirmPayment(order._id.toString(), userId);

    expect(payment.status).toBe(PaymentStatus.CONFIRMADO);
    expect(payment.save).toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.PRONTO);
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.save).toHaveBeenCalled();
    expect(result).toBe(order);
    expect(auditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment.confirmed', entity: 'Payment' }),
    );
    expect(auditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'order.paid', entity: 'Order' }),
    );
  });

  it('com preparo: pedido vai para PAGO (e não baixa estoque)', async () => {
    order.items = [{ requiresPrep: true, qty: 1 }];

    await service.confirmPayment(order._id.toString(), userId);

    expect(order.status).toBe(OrderStatus.PAGO);
    expect(order.save).toHaveBeenCalled();
  });

  it('é idempotente: pedido já pago não confirma pagamento de novo', async () => {
    order.status = OrderStatus.PRONTO;

    await service.confirmPayment(order._id.toString(), userId);

    expect(paymentModel.findOne).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(auditLogModel.create).not.toHaveBeenCalled();
    expect(order.populate).toHaveBeenCalled();
  });

  it('rejeita pedido que não está aguardando pagamento', async () => {
    order.status = OrderStatus.EM_EDICAO;

    await expect(service.confirmPayment(order._id.toString(), userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(order.save).not.toHaveBeenCalled();
  });

  it('rejeita pedido cancelado', async () => {
    order.status = OrderStatus.CANCELADO;

    await expect(service.confirmPayment(order._id.toString(), userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita quando não existe pagamento registrado', async () => {
    paymentModel.findOne.mockResolvedValue(null);

    await expect(service.confirmPayment(order._id.toString(), userId)).rejects.toThrow(
      /Nenhum pagamento/i,
    );
  });
});
