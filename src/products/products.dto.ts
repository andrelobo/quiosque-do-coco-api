import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';

export class CreateProductDto {
  @ApiProperty({ example: 'Coco Gelado 500ml' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['coco', 'cafe-da-manha', 'almoco', 'petiscos', 'drinks', 'outros'], example: 'coco' })
  @IsString()
  category: string;

  @ApiProperty({ example: 8.50, description: 'Preço em Reais (ex: 8.50)' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'un', default: 'un' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  requiresPrep?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  trackStock?: boolean;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Coco Gelado 500ml' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['coco', 'cafe-da-manha', 'almoco', 'petiscos', 'drinks', 'outros'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 9.00, description: 'Preço em Reais' })
  @IsOptional()
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'un' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  requiresPrep?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  trackStock?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;
}

export class AdjustStockDto {
  @ApiProperty({ example: 10, description: 'Quantidade (positivo = entrada, negativo = saída/perda)' })
  @IsNumber()
  qty: number;

  @ApiProperty({ example: 'Reposição de estoque' })
  @IsString()
  reason: string;
}