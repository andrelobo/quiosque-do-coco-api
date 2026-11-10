import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Converte campos monetários de Centavos (inteiro) para Reais (float) na resposta.
 *
 * Roda DEPOIS do TransformInterceptor (que normaliza documentos Mongoose e
 * ObjectIds). Ainda assim é defensivo: ignora Date, Buffer, ObjectId e
 * referências circulares, para nunca corromper a resposta.
 *
 * A conversão usa uma regra explícita (campos terminados em "Cents" + o
 * agregado `totalValue` dos relatórios), em vez de sufixos genéricos.
 */
@Injectable()
export class CurrencyResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.convert(data, new WeakSet())));
  }

  private convert(data: any, seen: WeakSet<object>): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;
    if (data instanceof Date || Buffer.isBuffer(data)) return data;
    if (this.isObjectId(data)) return data.toString();

    // Defensivo: se algum documento Mongoose escapar do TransformInterceptor.
    if (typeof data.toObject === 'function') {
      return this.convert(data.toObject({ virtuals: true }), seen);
    }

    if (seen.has(data)) return data;
    seen.add(data);

    if (Array.isArray(data)) {
      return data.map((item) => this.convert(item, seen));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.isCurrencyField(key) && typeof value === 'number' && Number.isFinite(value)) {
        // Centavos → Reais (ex.: 1050 → 10.50)
        result[key] = Math.round(value) / 100;
      } else {
        result[key] = this.convert(value, seen);
      }
    }
    return result;
  }

  private isObjectId(value: any): boolean {
    return !!value && typeof value === 'object' && typeof value.toHexString === 'function';
  }

  private isCurrencyField(key: string): boolean {
    // Todos os campos monetários da API terminam em "Cents" (priceCents,
    // totalCents, amountCents, changeCents, ...). Os relatórios agregam em
    // `totalValue`.
    return key.endsWith('Cents') || key === 'totalValue';
  }
}
