import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrderStatus } from './order.schema';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';

@ApiTags('Pedidos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Criar pedido' })
  create(@Body() body: {
    shiftId: string;
    items: Array<{ productId: string; qty: number; note?: string }>;
    pickupName?: string;
  }, @Req() req: any) {
    return this.ordersService.create({
      shiftId: new Types.ObjectId(body.shiftId),
      items: body.items.map((i) => ({
        productId: new Types.ObjectId(i.productId),
        qty: i.qty,
        note: i.note,
      })),
      pickupName: body.pickupName,
      createdBy: new Types.ObjectId(req.user.userId),
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Listar todos os pedidos (com paginação e busca)' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, example: '123' })
  findAll(@Query('status') status?: OrderStatus, @Query('page') page = 1, @Query('limit') limit = 10, @Query('search') search?: string) {
    return this.ordersService.findAll(status, Number(page), Number(limit), search);
  }

  @Get('shift/:shiftId')
  @ApiOperation({ summary: 'Listar pedidos do turno' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  findByShift(@Param('shiftId') shiftId: string, @Query('status') status?: OrderStatus) {
    return this.ordersService.findByShift(new Types.ObjectId(shiftId), status);
  }

  @Get('shift/:shiftId/pending-delivery')
  @ApiOperation({ summary: 'Pedidos pagos pendentes de entrega' })
  getPendingDelivery(@Param('shiftId') shiftId: string) {
    return this.ordersService.getPendingDelivery(new Types.ObjectId(shiftId));
  }

  @Get('code/:dayKey/:code')
  @ApiOperation({ summary: 'Buscar pedido por código do dia' })
  findByCode(@Param('dayKey') dayKey: string, @Param('code') code: string) {
    return this.ordersService.findByCode(dayKey, parseInt(code));
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/items')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Atualizar itens do pedido (em edição)' })
  updateItems(@Param('id') id: string, @Body() items: Array<{ productId: string; qty: number; note?: string }>, @Req() req: any) {
    return this.ordersService.updateItems(id, items, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Enviar para pagamento (reserva estoque)' })
  submitForPayment(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.submitForPayment(id, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/confirm-payment')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Confirmar pagamento e liberar para preparo/entrega' })
  confirmPayment(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.confirmPayment(id, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/prep')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Iniciar preparo' })
  startPrep(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.startPrep(id, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/ready')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Marcar como pronto' })
  markReady(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.markReady(id, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Entregar pedido' })
  deliver(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.deliver(id, new Types.ObjectId(req.user.userId));
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL, UserRole.ATENDENTE)
  @ApiOperation({ summary: 'Cancelar pedido (atendente só antes do pagamento)' })
  cancel(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.ordersService.cancel(
      id,
      new Types.ObjectId(req.user.userId),
      body.reason,
      req.user.role,
    );
  }
}