import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { ShiftStatus } from './shift.schema';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';

@ApiTags('Turnos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Abrir turno' })
  open(@Body() body: { initialCashCents: number; productIds: string[] }, @Req() req: any) {
    return this.shiftsService.open({
      openedBy: new Types.ObjectId(req.user.userId),
      initialCashCents: body.initialCashCents,
      productIds: body.productIds.map((id) => new Types.ObjectId(id)),
    });
  }

  @Get('current')
  @ApiOperation({ summary: 'Turno atual aberto' })
  current() {
    return this.shiftsService.findCurrent();
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  findAll() {
    return this.shiftsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  findById(@Param('id') id: string) {
    return this.shiftsService.findById(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Produtos disponíveis no turno' })
  getAvailableProducts(@Param('id') id: string) {
    return this.shiftsService.getAvailableProducts(id);
  }

  @Patch(':id/availability/:productId')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Ativar/desativar produto no turno' })
  updateAvailability(
    @Param('id') shiftId: string,
    @Param('productId') productId: string,
    @Body() body: { available: boolean },
  ) {
    return this.shiftsService.updateAvailability(shiftId, new Types.ObjectId(productId), body.available);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Fechar turno' })
  close(
    @Param('id') id: string,
    @Body() body: { countedCashCents: number; closingNotes?: string },
    @Req() req: any,
  ) {
    return this.shiftsService.close({
      shiftId: id,
      closedBy: new Types.ObjectId(req.user.userId),
      countedCashCents: body.countedCashCents,
      closingNotes: body.closingNotes,
    });
  }
}