import { IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';

export class OrderItemDto {
  @ApiProperty({ example: 'product-id' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ example: 'Sem gelo' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'shift-id' })
  @IsString()
  shiftId: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ example: 'João' })
  @IsOptional()
  @IsString()
  pickupName?: string;
}

export class UpdateOrderItemsDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Cliente desistiu' })
  @IsString()
  reason: string;
}