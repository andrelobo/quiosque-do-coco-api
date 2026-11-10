import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const isObjectId = (value: any): boolean =>
  !!value && typeof value === 'object' && typeof value.toHexString === 'function';

/**
 * Detecta se é um ObjectId serializado pelo Mongoose (tem propriedade buffer)
 */
const isSerializedObjectId = (value: any): boolean =>
  !!value && typeof value === 'object' && 'buffer' in value && Buffer.isBuffer(value.buffer);

/**
 * Normaliza as respostas da API:
 * - converte ObjectId em string (inclui ObjectId serializado com {buffer});
 * - expõe `id` a partir de `_id` (os .lean() do Mongoose não têm o virtual id);
 * - aplica os virtuals dos documentos Mongoose (ex.: availableQty);
 * - remove `__v`.
 *
 * Sem isso o frontend (que usa `id`) não consegue editar/excluir registros.
 */
function transform(value: any, depth = 0): any {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (isObjectId(value)) return value.toString();
  // ObjectId serializado pelo Mongoose: { buffer: <Buffer> }
  if (isSerializedObjectId(value)) return value.toString();
  // Documento Mongoose: converte antes de iterar, senão vêm campos internos.
  if (typeof value.toObject === 'function') {
    return transform(value.toObject({ virtuals: true }), depth + 1);
  }
  if (Array.isArray(value)) return value.map((item) => transform(item, depth + 1));

  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '__v') continue;
    result[key] = transform(item, depth + 1);
  }
  if (result._id !== undefined && result.id === undefined) {
    result.id = String(result._id);
  }
  return result;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transform(data)));
  }
}
