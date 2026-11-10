import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './payment.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { AuditLog, AuditLogSchema } from '../common/audit/audit.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    forwardRef(() => OrdersModule),
    ShiftsModule,
    AuditModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}