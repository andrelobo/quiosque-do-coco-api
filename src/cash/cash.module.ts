import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CashMovement, CashMovementSchema } from './cash.schema';
import { Shift, ShiftSchema } from '../shifts/shift.schema';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashMovement.name, schema: CashMovementSchema },
      { name: Shift.name, schema: ShiftSchema },
    ]),
    ShiftsModule,
  ],
  providers: [CashService],
  controllers: [CashController],
  exports: [CashService],
})
export class CashModule {}