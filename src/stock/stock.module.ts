import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockMovement, StockMovementSchema } from './stock.schema';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: StockMovement.name, schema: StockMovementSchema }])],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}