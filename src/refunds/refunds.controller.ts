import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';
import { CreateRefundDto } from './refunds.dto';

@ApiTags('Devoluções')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Criar devolução (pendente)' })
  create(@Body() dto: CreateRefundDto, @Req() req: any) {
    return this.refundsService.create({
      paymentId: new Types.ObjectId(dto.paymentId),
      orderId: new Types.ObjectId(dto.orderId),
      shiftId: new Types.ObjectId(dto.shiftId),
      amount: dto.amount,
      method: dto.method,
      reason: dto.reason,
      createdBy: req.user.userId,
    });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Devoluções do pedido' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.refundsService.findByOrder(new Types.ObjectId(orderId));
  }

  @Get('shift/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Devoluções do turno' })
  findByShift(@Param('shiftId') shiftId: string) {
    return this.refundsService.findByShift(new Types.ObjectId(shiftId));
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Concluir devolução' })
  complete(@Param('id') id: string, @Req() req: any) {
    return this.refundsService.complete(id, req.user.userId);
  }
}