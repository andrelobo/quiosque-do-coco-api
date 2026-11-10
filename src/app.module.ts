import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { ShiftsModule } from './shifts/shifts.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { RefundsModule } from './refunds/refunds.module';
import { StockModule } from './stock/stock.module';
import { CashModule } from './cash/cash.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './common/audit/audit.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    ShiftsModule,
    OrdersModule,
    PaymentsModule,
    RefundsModule,
    StockModule,
    CashModule,
    ReportsModule,
    AuditModule,
    SeedModule,
  ],
})
export class AppModule {}