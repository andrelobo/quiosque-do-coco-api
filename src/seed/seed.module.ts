import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { StockMovement, StockMovementSchema } from '../stock/stock.schema';
import { CashMovement, CashMovementSchema } from '../cash/cash.schema';
import { Refund, RefundSchema } from '../refunds/refund.schema';
import { SeedService } from './seed.service';
import { SeedDataService } from './seed-data.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: CashMovement.name, schema: CashMovementSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
  ],
  providers: [SeedService, SeedDataService],
  exports: [SeedService, SeedDataService],
})
export class SeedModule {}