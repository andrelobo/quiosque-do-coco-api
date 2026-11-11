import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shift, ShiftSchema } from './shift.schema';
import { Product, ProductSchema } from '../products/product.schema';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ProductsModule } from '../products/products.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shift.name, schema: ShiftSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    ProductsModule,
    ReportsModule,
  ],
  providers: [ShiftsService],
  controllers: [ShiftsController],
  exports: [ShiftsService],
})
export class ShiftsModule {}