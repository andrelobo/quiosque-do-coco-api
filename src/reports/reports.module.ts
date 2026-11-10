import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/order.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { Refund, RefundSchema } from '../refunds/refund.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { StockMovement, StockMovementSchema } from '../stock/stock.schema';
import { CashMovement, CashMovementSchema } from '../cash/cash.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Product.name, schema: ProductSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: CashMovement.name, schema: CashMovementSchema },
    ]),
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}