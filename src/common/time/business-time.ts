/**
 * O servidor roda em UTC (container), mas a operação do quiosque acontece no
 * fuso do negócio. Tudo que depende de "dia" (código do pedido, numeração do
 * turno, filtros de relatório) passa por aqui para não virar o dia às 21h.
 */
export const DEFAULT_BUSINESS_TIMEZONE = 'America/Sao_Paulo';

export function getBusinessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim() || DEFAULT_BUSINESS_TIMEZONE;
}

/** Dia do negócio no formato YYYY-MM-DD. */
export function businessDayKey(date: Date = new Date(), timeZone = getBusinessTimezone()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Diferença (ms) entre o horário local no fuso e o UTC para um instante. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new RangeError('Data deve estar no formato YYYY-MM-DD');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError('Data inválida');
  }
  return { year, month, day };
}

export function addDaysToDayKey(dayKey: string, days: number): string {
  const { year, month, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Instante em que o dia começa no fuso do negócio. */
export function startOfBusinessDay(dayKey: string, timeZone = getBusinessTimezone()): Date {
  const { year, month, day } = parseDayKey(dayKey);
  const utcGuess = Date.UTC(year, month - 1, day);
  let candidate = utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone);
  // Recalcula com o palpite já convertido para cobrir mudança de offset.
  const adjusted = utcGuess - timeZoneOffsetMs(new Date(candidate), timeZone);
  if (adjusted !== candidate) candidate = adjusted;
  return new Date(candidate);
}

/**
 * Intervalo fechado do dia no fuso do negócio.
 * `endExclusive` é prático para consultas com `$lt`.
 */
export function businessDayRange(dayKey: string, timeZone = getBusinessTimezone()) {
  const start = startOfBusinessDay(dayKey, timeZone);
  const endExclusive = startOfBusinessDay(addDaysToDayKey(dayKey, 1), timeZone);
  return { start, end: new Date(endExclusive.getTime() - 1), endExclusive };
}
