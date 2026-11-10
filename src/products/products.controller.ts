import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductCategory } from './product.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.schema';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from './products.dto';

@ApiTags('Produtos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  @ApiOperation({ summary: 'Criar produto' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create({
      name: dto.name,
      category: dto.category as ProductCategory,
      price: dto.price,
      unit: dto.unit,
      requiresPrep: dto.requiresPrep,
      trackStock: dto.trackStock,
      stockQty: dto.stockQty,
    });
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
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const updateData: any = { ...dto };
    if (dto.category) updateData.category = dto.category as ProductCategory;
    return this.productsService.update(id, updateData);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  setActive(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.productsService.setActive(id, body.active);
  }

  @Patch(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.RESPONSAVEL)
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto, @Req() req: any) {
    return this.productsService.adjustStock(id, dto.qty, dto.reason, req.user.userId);
  }
}