import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';
import { PaymentMethod, CardType } from './payment.schema';

export class CreatePaymentDto {
  @ApiProperty({ example: 'order-id' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'shift-id' })
  @IsString()
  shiftId: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.DINHEIRO })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 25.50, description: 'Valor do pagamento em Reais' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 30.00, description: 'Valor recebido (apenas dinheiro) em Reais' })
  @IsOptional()
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  received?: number;

  @ApiPropertyOptional({ enum: CardType, example: CardType.DEBITO })
  @IsOptional()
  @IsEnum(CardType)
  cardType?: CardType;

  @ApiPropertyOptional({ example: 'PIX-123456' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ example: 'Cliente não completou o Pix' })
  @IsString()
  reason: string;
}