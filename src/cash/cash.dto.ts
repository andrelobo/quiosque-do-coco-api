import { IsNumber, IsString, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';
import { CashMovementType } from './cash.schema';

export class CreateCashMovementDto {
  @ApiProperty({ example: 'shift-id' })
  @IsString()
  shiftId: string;

  @ApiProperty({ enum: CashMovementType, example: CashMovementType.REFORCO })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  @ApiProperty({ example: 100.00, description: 'Valor em Reais' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Troco para o caixa' })
  @IsString()
  reason: string;
}