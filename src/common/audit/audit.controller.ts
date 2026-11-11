import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { UserRole } from '../../users/user.schema';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

@ApiTags('Auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Listar logs de auditoria (mais recentes primeiro)' })
  @ApiQuery({ name: 'action', required: false, type: String, example: 'order.paid' })
  @ApiQuery({ name: 'entity', required: false, type: String, example: 'Order' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'start', required: false, type: String, example: '2026-11-01' })
  @ApiQuery({ name: 'end', required: false, type: String, example: '2026-11-30' })
  findAll(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    if (userId && !OBJECT_ID.test(userId)) {
      throw new BadRequestException('userId inválido');
    }

    return this.auditService.findAll({
      action,
      entity,
      userId: userId ? new Types.ObjectId(userId) : undefined,
      start: this.parseDate(start, 'start'),
      end: this.parseDate(end, 'end'),
    });
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({ summary: 'Histórico de auditoria de uma entidade' })
  findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    if (!OBJECT_ID.test(entityId)) {
      throw new BadRequestException('entityId inválido');
    }
    return this.auditService.findByEntity(entity, new Types.ObjectId(entityId));
  }

  private parseDate(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} inválido`);
    }
    return date;
  }
}
