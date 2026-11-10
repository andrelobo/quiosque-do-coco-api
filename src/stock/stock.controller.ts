import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';

@ApiTags('Estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('product/:productId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Movimentações do produto' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByProduct(@Param('productId') productId: string, @Query('limit') limit?: number) {
    return this.stockService.findByProduct(new Types.ObjectId(productId), limit || 100);
  }

  @Get('product/:productId/balance')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Saldo atual calculado do produto' })
  getBalance(@Param('productId') productId: string) {
    return this.stockService.getProductBalance(new Types.ObjectId(productId));
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Movimentações do pedido' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.stockService.findByOrder(new Types.ObjectId(orderId));
  }
}