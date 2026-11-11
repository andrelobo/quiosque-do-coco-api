import { IsNumber, IsOptional, IsArray, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';

export class OpenShiftDto {
  @ApiProperty({ example: 200.00, description: 'Fundo inicial em Reais (ex: 200.00)' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialCash: number;

  @ApiProperty({ type: [String], example: ['prod-id-1', 'prod-id-2'] })
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}

export class UpdateAvailabilityDto {
  @ApiProperty({ example: true })
  available: boolean;
}

export class CloseShiftDto {
  @ApiProperty({ example: 450.75, description: 'Dinheiro contado no fechamento em Reais' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCash: number;

  @ApiPropertyOptional({ example: 'Fechamento normal' })
  @IsOptional()
  @IsString()
  closingNotes?: string;
}