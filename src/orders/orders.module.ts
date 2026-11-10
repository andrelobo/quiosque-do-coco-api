import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { StockMovement, StockMovementSchema } from '../stock/stock.schema';
import { AuditLog, AuditLogSchema } from '../common/audit/audit.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { PaymentsModule } from '../payments/payments.module';
import { StockModule } from '../stock/stock.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    ProductsModule,
    ShiftsModule,
    forwardRef(() => PaymentsModule),
    StockModule,
    AuditModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}