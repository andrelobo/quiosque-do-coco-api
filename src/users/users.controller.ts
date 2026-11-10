import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserRole } from './user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Usuários')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar usuário (apenas admin)' })
  create(@Body() body: { name: string; username: string; password: string; role?: UserRole }) {
    return this.usersService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Listar usuários ativos' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário logado' })
  me(@Req() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: { name?: string; role?: UserRole; active?: boolean }) {
    return this.usersService.update(id, body);
  }

  @Patch(':id/password')
  @Roles(UserRole.ADMIN)
  changePassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.usersService.changePassword(id, body.password);
  }
}