import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../users/user.schema';
import { Product, ProductDocument, ProductCategory } from '../products/product.schema';
import { Shift, ShiftDocument, ShiftStatus } from '../shifts/shift.schema';
import { Order, OrderDocument, OrderStatus, OrderItem } from '../orders/order.schema';
import { Payment, PaymentDocument, PaymentMethod, PaymentStatus } from '../payments/payment.schema';
import { StockMovement, StockMovementDocument, StockMovementType } from '../stock/stock.schema';
import { CashMovement, CashMovementDocument, CashMovementType } from '../cash/cash.schema';
import { Refund, RefundDocument } from '../refunds/refund.schema';

@Injectable()
export class SeedDataService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(CashMovement.name) private cashMovementModel: Model<CashMovementDocument>,
    @InjectModel(Refund.name) private refundModel: Model<RefundDocument>,
  ) {}

  async runFullSeed() {
    console.log('🌱 Iniciando seed completo...');
    
    // Limpar dados existentes (exceto o admin que criamos)
    await this.clearTestData();
    
    // 1. Usuários
    const users = await this.seedUsers();
    console.log(`✅ ${users.length} usuários criados`);
    
    // 2. Produtos
    const products = await this.seedProducts();
    console.log(`✅ ${products.length} produtos criados`);
    
    // 3. Turnos históricos (últimos 7 dias)
    const shifts = await this.seedShifts(users, products);
    console.log(`✅ ${shifts.length} turnos criados`);
    
    // 4. Pedidos, Pagamentos, Movimentações para cada turno
    for (const shift of shifts) {
      await this.seedOrdersForShift(shift, users, products);
    }
    console.log('✅ Pedidos, pagamentos e estoque criados');
    
    console.log('🎉 Seed completo finalizado!');
    return { users, products, shifts };
  }

  private async clearTestData() {
    await this.orderModel.deleteMany({});
    await this.paymentModel.deleteMany({});
    await this.stockMovementModel.deleteMany({});
    await this.cashMovementModel.deleteMany({});
    await this.refundModel.deleteMany({});
    await this.shiftModel.deleteMany({});
    // Manter usuários e produtos
  }

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async seedUsers() {
    const usersData = [
      { name: 'Administrador', username: 'admin', password: 'admin123', role: UserRole.ADMIN },
      { name: 'André Lobo', username: 'loboandre@hotmail.com', password: 'Hope70x07@', role: UserRole.ADMIN },
      { name: 'Maria Responsável', username: 'maria.resp', password: 'resp123', role: UserRole.RESPONSAVEL },
      { name: 'João Atendente', username: 'joao.atend', password: 'atend123', role: UserRole.ATENDENTE },
      { name: 'Ana Atendente', username: 'ana.atend', password: 'atend123', role: UserRole.ATENDENTE },
      { name: 'Carlos Atendente', username: 'carlos.atend', password: 'atend123', role: UserRole.ATENDENTE },
    ];

    const users = [];
    for (const u of usersData) {
      const existing = await this.userModel.findOne({ username: u.username });
      if (!existing) {
        const passwordHash = await this.hashPassword(u.password);
        const user = new this.userModel({ ...u, passwordHash });
        await user.save();
        users.push(user);
      } else {
        users.push(existing);
      }
    }
    return users;
  }

  private async seedProducts() {
    const productsData = [
      // Coco - produto principal
      { name: 'Coco Gelado', category: ProductCategory.COCO, priceCents: 800, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 100 },
      { name: 'Coco Gelado Grande', category: ProductCategory.COCO, priceCents: 1000, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 60 },
      { name: 'Coco com Leite Condensado', category: ProductCategory.COCO, priceCents: 1000, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 40 },
      { name: 'Coco Vampiro (com vinho)', category: ProductCategory.COCO, priceCents: 1200, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 20 },
      
      // Café da manhã
      { name: 'Café Coado', category: ProductCategory.CAFE_DA_MANHA, priceCents: 300, unit: 'un', requiresPrep: false, trackStock: false },
      { name: 'Café com Leite', category: ProductCategory.CAFE_DA_MANHA, priceCents: 400, unit: 'un', requiresPrep: false, trackStock: false },
      { name: 'Pão de Queijo', category: ProductCategory.CAFE_DA_MANHA, priceCents: 500, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 80 },
      { name: 'Misto Quente', category: ProductCategory.CAFE_DA_MANHA, priceCents: 700, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Croissant', category: ProductCategory.CAFE_DA_MANHA, priceCents: 600, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 30 },
      { name: 'Tapioca', category: ProductCategory.CAFE_DA_MANHA, priceCents: 800, unit: 'un', requiresPrep: true, trackStock: false },
      
      // Almoço
      { name: 'PF Completo', category: ProductCategory.ALMOCO, priceCents: 1800, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Marmitinha', category: ProductCategory.ALMOCO, priceCents: 1200, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'PF Vegetariano', category: ProductCategory.ALMOCO, priceCents: 1600, unit: 'un', requiresPrep: true, trackStock: false },
      
      // Petiscos
      { name: 'Batata Frita', category: ProductCategory.PETISCOS, priceCents: 900, unit: 'porção', requiresPrep: true, trackStock: false },
      { name: 'Batata Frita Grande', category: ProductCategory.PETISCOS, priceCents: 1300, unit: 'porção', requiresPrep: true, trackStock: false },
      { name: 'Pastel de Carne', category: ProductCategory.PETISCOS, priceCents: 600, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Pastel de Queijo', category: ProductCategory.PETISCOS, priceCents: 600, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Coxinha', category: ProductCategory.PETISCOS, priceCents: 500, unit: 'un', requiresPrep: true, trackStock: true, stockQty: 50 },
      { name: 'Calabresa Acebolada', category: ProductCategory.PETISCOS, priceCents: 1100, unit: 'porção', requiresPrep: true, trackStock: false },
      
      // Drinks
      { name: 'Água Mineral 500ml', category: ProductCategory.DRINKS, priceCents: 300, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 100 },
      { name: 'Água Mineral 1.5L', category: ProductCategory.DRINKS, priceCents: 500, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 40 },
      { name: 'Refrigerante Lata', category: ProductCategory.DRINKS, priceCents: 500, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 80 },
      { name: 'Refrigerante 2L', category: ProductCategory.DRINKS, priceCents: 800, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 24 },
      { name: 'Suco Natural (Laranja/Maracujá)', category: ProductCategory.DRINKS, priceCents: 600, unit: 'un', requiresPrep: true, trackStock: false },
      { name: 'Água de Coco Natural', category: ProductCategory.DRINKS, priceCents: 700, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 30 },
      { name: 'Cerveja Lata', category: ProductCategory.DRINKS, priceCents: 600, unit: 'un', requiresPrep: false, trackStock: true, stockQty: 48 },
      { name: 'Caipirinha', category: ProductCategory.DRINKS, priceCents: 1200, unit: 'un', requiresPrep: true, trackStock: false },
    ];

    const products = [];
    for (const p of productsData) {
      const existing = await this.productModel.findOne({ name: p.name });
      if (!existing) {
        const product = new this.productModel(p);
        await product.save();
        products.push(product);
      } else {
        products.push(existing);
      }
    }
    return products;
  }

  private async seedShifts(users: UserDocument[], products: ProductDocument[]) {
    const shifts = [];
    const atendentes = users.filter(u => u.role === UserRole.ATENDENTE);
    const responsaveis = users.filter(u => u.role === UserRole.RESPONSAVEL);
    const allStaff = [...atendentes, ...responsaveis];

    // Últimos 7 dias
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      date.setHours(0, 0, 0, 0);

      // 1 a 2 turnos por dia
      const shiftsPerDay = dayOffset === 0 ? 1 : (Math.random() > 0.3 ? 2 : 1);
      
      for (let s = 0; s < shiftsPerDay; s++) {
        const shiftDate = new Date(date);
        if (s === 0) {
          shiftDate.setHours(8, 0, 0, 0); // Manhã
        } else {
          shiftDate.setHours(16, 0, 0, 0); // Tarde/Noite
        }

        const responsible = allStaff[Math.floor(Math.random() * allStaff.length)];
        const initialCash = 5000 + Math.floor(Math.random() * 5000); // 50 a 100 reais
        
        // Selecionar produtos disponíveis (80% ativos)
        const availableProducts = products
          .filter(p => p.active && Math.random() > 0.2)
          .map(p => p._id);

        const newShift: ShiftDocument = new this.shiftModel({
          number: shifts.length + 1,
          status: dayOffset === 0 && s === shiftsPerDay - 1 ? ShiftStatus.ABERTO : ShiftStatus.FECHADO,
          openedBy: responsible._id,
          openedAt: shiftDate,
          initialCashCents: initialCash,
          closedBy: dayOffset === 0 && s === shiftsPerDay - 1 ? undefined : allStaff[Math.floor(Math.random() * allStaff.length)]._id,
          closedAt: dayOffset === 0 && s === shiftsPerDay - 1 ? undefined : new Date(shiftDate.getTime() + 8 * 60 * 60 * 1000),
          availability: availableProducts.map(p => ({ product: p, available: true })),
        });

        await newShift.save();
        shifts.push(newShift);
      }
    }
    return shifts;
  }

  private generateDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private async seedOrdersForShift(shift: ShiftDocument, users: UserDocument[], products: ProductDocument[]) {
    const atendentes = users.filter(u => u.role === UserRole.ATENDENTE);
    const availableProducts = shift.availability.filter(a => a.available).map(a => a.product);
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    
    // 5 a 25 pedidos por turno
    const orderCount = 5 + Math.floor(Math.random() * 20);
    
    for (let i = 0; i < orderCount; i++) {
      const orderTime = new Date(shift.openedAt.getTime() + Math.random() * 8 * 60 * 60 * 1000);
      const atendente = atendentes[Math.floor(Math.random() * atendentes.length)];
      
      // Gerar código único por dia: shift.number * 1000 + i + 1
      // Isso garante códigos únicos por dia mesmo com múltiplos turnos
      const orderCode = shift.number * 1000 + i + 1;
      
      // 1 a 5 itens por pedido
      const itemCount = 1 + Math.floor(Math.random() * 4);
      const shuffledProducts = [...availableProducts].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffledProducts.slice(0, itemCount);
      
      const items: OrderItem[] = [];
      let totalCents = 0;
      
      for (const prodId of selectedProducts) {
        const product = productMap.get(prodId.toString());
        if (!product) continue;
        
        const qty = 1 + Math.floor(Math.random() * 3);
        items.push({
          product: product._id,
          name: product.name,
          unitPriceCents: product.priceCents,
          qty,
          trackStock: product.trackStock,
          requiresPrep: product.requiresPrep,
        });
        totalCents += product.priceCents * qty;
      }
      
      if (items.length === 0) continue;

      const dayKey = this.generateDayKey(orderTime);
      const order = new this.orderModel({
        code: orderCode,
        dayKey,
        shift: shift._id,
        items,
        totalCents,
        status: OrderStatus.ENTREGUE,
        pickupName: Math.random() > 0.7 ? `Cliente ${i + 1}` : undefined,
        createdBy: atendente._id,
        paidAt: new Date(orderTime.getTime() + 2 * 60 * 1000),
        deliveredAt: new Date(orderTime.getTime() + 5 * 60 * 1000),
        deliveredBy: atendente._id,
        stockReserved: false,
      });
      
      await order.save();

      // Pagamento
      const paymentMethods: PaymentMethod[] = [PaymentMethod.DINHEIRO, PaymentMethod.PIX, PaymentMethod.CARTAO];
      const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      
      let receivedCents = totalCents;
      let changeCents = 0;
      let cardType = undefined;
      
      if (method === 'dinheiro') {
        receivedCents = totalCents + Math.floor(Math.random() * 5000); // Troco
        changeCents = receivedCents - totalCents;
      } else if (method === 'cartao') {
        cardType = Math.random() > 0.5 ? 'debito' : 'credito';
      }

      const payment = new this.paymentModel({
        order: order._id,
        shift: shift._id,
        method,
        cardType,
        amountCents: totalCents,
        receivedCents,
        changeCents,
        status: PaymentStatus.CONFIRMADO,
        reference: method === 'pix' ? `PIX${Date.now()}${Math.floor(Math.random() * 1000)}` : undefined,
        confirmedBy: atendente._id,
        confirmedAt: new Date(orderTime.getTime() + 2 * 60 * 1000),
      });
      await payment.save();

      // Movimentações de estoque
      for (const item of items) {
        const product = productMap.get(item.product.toString());
        if (!product || !product.trackStock) continue;

        // Reserva
        await this.stockMovementModel.create({
          product: item.product,
          type: StockMovementType.RESERVA,
          qty: item.qty,
          balanceAfter: product.stockQty,
          order: order._id,
          reason: `Reserva para pedido ${order.code}`,
          user: atendente._id,
        });

        // Saída
        await this.stockMovementModel.create({
          product: item.product,
          type: StockMovementType.SAIDA,
          qty: item.qty,
          balanceAfter: Math.max(0, product.stockQty - item.qty),
          order: order._id,
          reason: `Entrega do pedido ${order.code}`,
          user: atendente._id,
        });

        // Atualizar produto
        product.stockQty = Math.max(0, product.stockQty - item.qty);
        await product.save();
      }

      // Movimentações de caixa (reforços/retiradas aleatórias)
      if (Math.random() > 0.8) {
        await this.cashMovementModel.create({
          shift: shift._id,
          type: Math.random() > 0.5 ? CashMovementType.REFORCO : CashMovementType.RETIRADA,
          amountCents: 1000 + Math.floor(Math.random() * 5000),
          reason: Math.random() > 0.5 ? 'Reforço de troco' : 'Retirada para despesas',
          user: atendente._id,
        });
      }
    }

    // Calcular fechamento de caixa para turnos fechados
    if (shift.status === ShiftStatus.FECHADO) {
      await this.calculateShiftClosing(shift);
    }
  }

  private async calculateShiftClosing(shift: ShiftDocument) {
    const payments = await this.paymentModel.find({ 
      shift: shift._id, 
      status: PaymentStatus.CONFIRMADO 
    });
    
    const cashReceived = payments
      .filter(p => p.method === PaymentMethod.DINHEIRO)
      .reduce((sum, p) => sum + p.amountCents, 0);
    
    const cashMovements = await this.cashMovementModel.find({ shift: shift._id });
    const reforcos = cashMovements
      .filter(m => m.type === CashMovementType.REFORCO)
      .reduce((sum, m) => sum + m.amountCents, 0);
    const retiradas = cashMovements
      .filter(m => m.type === CashMovementType.RETIRADA)
      .reduce((sum, m) => sum + m.amountCents, 0);

    const expectedCash = shift.initialCashCents + cashReceived + reforcos - retiradas;
    
    // Simular contagem com pequena variação (±200 centavos)
    const variation = Math.floor(Math.random() * 400) - 200;
    const countedCash = Math.max(0, expectedCash + variation);

    shift.expectedCashCents = expectedCash;
    shift.countedCashCents = countedCash;
    shift.differenceCents = countedCash - expectedCash;
    await shift.save();
  }
}