import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Refund, RefundSchema } from './refund.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Payment, PaymentSchema } from '../payments/payment.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { AuditLog, AuditLogSchema } from '../common/audit/audit.schema';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Refund.name, schema: RefundSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    ShiftsModule,
    AuditModule,
  ],
  providers: [RefundsService],
  controllers: [RefundsController],
  exports: [RefundsService],
})
export class RefundsModule {}