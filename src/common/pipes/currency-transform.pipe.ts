import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

/**
 * Pipe que converte valores monetários de Reais (float) para Centavos (inteiro)
 * na entrada da API. Campos marcados com @CurrencyField() são convertidos automaticamente.
 */
@Injectable()
export class CurrencyTransformPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (!value || typeof value !== 'object') return value;
    if (!metadata.metatype) return value;

    const currencyFields = Reflect.getMetadata('currencyFields', metadata.metatype) || [];
    if (currencyFields.length === 0) return value;

    const dto = plainToInstance(metadata.metatype, value);

    for (const field of currencyFields) {
      const val = dto[field];
      if (val !== undefined && val !== null && typeof val === 'number') {
        // Reais → Centavos (ex: 10.50 → 1050)
        dto[field] = Math.round(val * 100);
      }
    }

    return dto;
  }
}

/**
 * Decorator para marcar campos que devem ser convertidos Reais ↔ Centavos
 * Uso: @CurrencyField() @IsNumber() price: number;
 */
export const CurrencyField = () => (target: any, propertyKey: string) => {
  const existing = Reflect.getMetadata('currencyFields', target.constructor) || [];
  Reflect.defineMetadata('currencyFields', [...existing, propertyKey], target.constructor);
};

/**
 * Helper para aplicar em DTOs existentes sem decorator (ex: objetos aninhados)
 */
export function convertReaisToCents(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const field of fields) {
    if (result[field] !== undefined && typeof result[field] === 'number') {
      result[field] = Math.round(result[field] * 100);
    }
  }
  
  return result;
}