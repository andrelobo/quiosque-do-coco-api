import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';
import { CreateCashMovementDto } from './cash.dto';

@ApiTags('Caixa - Reforços e Retiradas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Registrar reforço ou retirada' })
  create(@Body() dto: CreateCashMovementDto, @Req() req: any) {
    return this.cashService.create({
      shiftId: new Types.ObjectId(dto.shiftId),
      type: dto.type,
      amount: dto.amount,
      reason: dto.reason,
      userId: req.user.userId,
    });
  }

  @Get('shift/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Movimentações do turno' })
  findByShift(@Param('shiftId') shiftId: string) {
    return this.cashService.findByShift(new Types.ObjectId(shiftId));
  }

  @Get('shift/:shiftId/totals')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Totais de reforços e retiradas do turno' })
  getTotals(@Param('shiftId') shiftId: string) {
    return this.cashService.getShiftTotals(new Types.ObjectId(shiftId));
  }
}