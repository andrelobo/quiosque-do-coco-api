import { Injectable, NestInterceptor, ExecutionContext, CallHandler, SetMetadata } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor que converte Centavos (inteiro) → Reais (float) na resposta da API.
 * Detecta campos monetários por sufixo convencional (*Cents, *Price, *Amount, *Total, *Cash).
 */
@Injectable()
export class CurrencyResponseInterceptor implements NestInterceptor {
  private readonly currencySuffixes = [
    'Cents',      // priceCents, amountCents, totalCents, changeCents
    'Price',      // unitPrice, salePrice
    'Amount',     // amount, receivedAmount
    'Total',      // total, subtotal
    'Cash',       // initialCash, countedCash, expectedCash, differenceCash
    'Value',      // value (genérico)
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(data => this.convertCentsToReais(data)));
  }

  private convertCentsToReais(data: any): any {
    if (data === null || data === undefined) return data;
    
    // Arrays: processa cada item
    if (Array.isArray(data)) {
      return data.map(item => this.convertCentsToReais(item));
    }

    // Primitivos: retorna como está
    if (typeof data !== 'object') return data;

    // Objetos: processa recursivamente
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Converte se for campo monetário conhecido
      if (this.isCurrencyField(key) && typeof value === 'number') {
        result[key] = value / 100; // 1050 → 10.50
      }
      // Recursão para objetos aninhados
      else if (value !== null && typeof value === 'object') {
        result[key] = this.convertCentsToReais(value);
      }
      // Demais valores: copia
      else {
        result[key] = value;
      }
    }

    return result;
  }

  private isCurrencyField(key: string): boolean {
    return this.currencySuffixes.some(suffix => key.endsWith(suffix));
  }
}

/**
 * Decorator para desativar a conversão em endpoints específicos
 * Uso: @SkipCurrencyTransform() @Get() async findAll() { ... }
 */
export const SKIP_CURRENCY_TRANSFORM = 'skipCurrencyTransform';
export const SkipCurrencyTransform = () => SetMetadata(SKIP_CURRENCY_TRANSFORM, true);