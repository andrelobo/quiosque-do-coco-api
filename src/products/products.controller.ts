import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductCategory } from './product.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';

@ApiTags('Produtos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Criar produto' })
  create(@Body() body: {
    name: string;
    category: ProductCategory;
    priceCents: number;
    unit?: string;
    requiresPrep?: boolean;
    trackStock?: boolean;
    stockQty?: number;
  }) {
    return this.productsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar produtos' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.productsService.findAll(includeInactive === 'true');
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Listar produtos por categoria' })
  findByCategory(@Param('category') category: ProductCategory) {
    return this.productsService.findByCategory(category);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  update(@Param('id') id: string, @Body() body: Partial<{
    name: string;
    category: ProductCategory;
    priceCents: number;
    unit: string;
    active: boolean;
    requiresPrep: boolean;
    trackStock: boolean;
    stockQty: number;
  }>) {
    return this.productsService.update(id, body);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  setActive(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.productsService.setActive(id, body.active);
  }

  @Patch(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  adjustStock(@Param('id') id: string, @Body() body: { qty: number; reason: string }, @Req() req: any) {
    return this.productsService.adjustStock(id, body.qty, body.reason, req.user.userId);
  }
}