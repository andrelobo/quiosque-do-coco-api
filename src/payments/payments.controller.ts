import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';
import { CreatePaymentDto, RejectPaymentDto } from './payments.dto';

@ApiTags('Pagamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Registrar pagamento (pendente)' })
  create(@Body() dto: CreatePaymentDto, @Req() req: any) {
    return this.paymentsService.create({
      orderId: new Types.ObjectId(dto.orderId),
      shiftId: new Types.ObjectId(dto.shiftId),
      method: dto.method,
      amount: dto.amount,
      received: dto.received,
      cardType: dto.cardType,
      reference: dto.reference,
      createdBy: req.user.userId,
    });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Pagamentos do pedido' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrder(new Types.ObjectId(orderId));
  }

  @Get('shift/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Pagamentos do turno' })
  findByShift(@Param('shiftId') shiftId: string) {
    return this.paymentsService.findByShift(new Types.ObjectId(shiftId));
  }

  @Get('shift/:shiftId/summary')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Resumo de pagamentos do turno' })
  getShiftSummary(@Param('shiftId') shiftId: string) {
    return this.paymentsService.getShiftSummary(new Types.ObjectId(shiftId));
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Confirmar pagamento' })
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.confirm(id, req.user.userId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Rejeitar pagamento (não confirmado)' })
  reject(@Param('id') id: string, @Body() dto: RejectPaymentDto, @Req() req: any) {
    return this.paymentsService.reject(id, req.user.userId, dto.reason);
  }
}