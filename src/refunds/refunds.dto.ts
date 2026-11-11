import { IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrencyField } from '../common/pipes/currency-transform.pipe';

export class CreateRefundDto {
  @ApiProperty({ example: 'payment-id' })
  @IsString()
  paymentId: string;

  @ApiProperty({ example: 'order-id' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'shift-id' })
  @IsString()
  shiftId: string;

  @ApiProperty({ example: 15.00, description: 'Valor da devolução em Reais' })
  @CurrencyField()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ['dinheiro', 'pix', 'cartao'], example: 'dinheiro' })
  @IsEnum(['dinheiro', 'pix', 'cartao'])
  method: string;

  @ApiProperty({ example: 'Produto com defeito' })
  @IsString()
  reason: string;
}