import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const isObjectId = (value: any): boolean =>
  !!value &&
  typeof value === 'object' &&
  (typeof value.toHexString === 'function' || value._bsontype === 'ObjectId');

/**
 * Detecta ObjectId já serializado pelo Mongoose ({ buffer: <Buffer de 12 bytes> }).
 * Exige que seja o único campo para não confundir com objetos de negócio.
 */
const isSerializedObjectId = (value: any): boolean =>
  !!value &&
  typeof value === 'object' &&
  'buffer' in value &&
  Buffer.isBuffer(value.buffer) &&
  value.buffer.length === 12 &&
  Object.keys(value).length === 1;

function objectIdToString(value: any): string {
  if (isObjectId(value)) return value.toString();
  if (isSerializedObjectId(value)) return value.buffer.toString('hex');
  return String(value);
}

/**
 * Normaliza as respostas da API:
 * - converte ObjectId em string (inclui ObjectId serializado com {buffer});
 * - expõe `id` a partir de `_id` (os .lean() do Mongoose não têm o virtual id);
 * - aplica os virtuals dos documentos Mongoose (ex.: availableQty);
 * - remove `__v` e `_id`.
 *
 * Sem isso o frontend (que usa `id`) não consegue editar/entregar/cobrar registros.
 */
function transform(value: any, seen: WeakSet<object>, depth = 0): any {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (isObjectId(value)) return value.toString();
  if (isSerializedObjectId(value)) return value.buffer.toString('hex');

  // Documento Mongoose: converte para objeto simples (com virtuals) antes de iterar.
  if (typeof value.toObject === 'function') {
    return transform(value.toObject({ virtuals: true }), seen, depth + 1);
  }

  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => transform(item, seen, depth + 1));
  }

  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '__v' || key === '_id') continue;
    result[key] = transform(item, seen, depth + 1);
  }
  // Garante que _id nunca vaze na resposta (converte para id se existir no valor original)
  if (value._id !== undefined && result.id === undefined) {
    result.id = objectIdToString(value._id);
  }
  return result;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transform(data, new WeakSet())));
  }
}
