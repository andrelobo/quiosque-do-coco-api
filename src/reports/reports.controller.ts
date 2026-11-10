import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';

@ApiTags('Relatórios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales/period-shift')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Vendas por período e turno' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  salesByPeriodAndShift(@Query('start') start?: string, @Query('end') end?: string) {
    return this.reportsService.salesByPeriodAndShift(start, end);
  }

  @Get('sales/by-product')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Vendas por produto' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  salesByProduct(@Query('start') start?: string, @Query('end') end?: string) {
    return this.reportsService.salesByProduct(start, end);
  }

  @Get('payments/by-method')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Pagamentos por modalidade' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  paymentsByMethod(@Query('start') start?: string, @Query('end') end?: string) {
    return this.reportsService.paymentsByMethod(start, end);
  }

  @Get('cash/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Resumo do caixa do turno' })
  cashSummary(@Param('shiftId') shiftId: string) {
    return this.reportsService.cashSummary(shiftId);
  }

  @Get('orders/pending-delivery')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Pedidos pagos pendentes de entrega' })
  @ApiQuery({ name: 'shiftId', required: false, type: String })
  pendingDelivery(@Query('shiftId') shiftId?: string) {
    return this.reportsService.pendingDelivery(shiftId);
  }

  @Get('cancellations-refunds')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Cancelamentos e devoluções' })
  @ApiQuery({ name: 'start', required: false, type: String })
  @ApiQuery({ name: 'end', required: false, type: String })
  cancellationsAndRefunds(@Query('start') start?: string, @Query('end') end?: string) {
    return this.reportsService.cancellationsAndRefunds(start, end);
  }

  @Get('stock')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Relatório de estoque' })
  @ApiQuery({ name: 'productId', required: false, type: String })
  stockReport(@Query('productId') productId?: string) {
    return this.reportsService.stockReport(productId);
  }
}