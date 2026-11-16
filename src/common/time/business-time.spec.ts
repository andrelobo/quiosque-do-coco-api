import { describe, it, expect } from 'vitest';
import {
  addDaysToDayKey,
  businessDayKey,
  businessDayRange,
  startOfBusinessDay,
} from './business-time';

const TZ = 'America/Sao_Paulo';

describe('business-time', () => {
  it('vira o dia à meia-noite de São Paulo, não à meia-noite UTC', () => {
    expect(businessDayKey(new Date('2026-11-16T02:59:59.999Z'), TZ)).toBe('2026-11-15');
    expect(businessDayKey(new Date('2026-11-16T03:00:00.000Z'), TZ)).toBe('2026-11-16');
    expect(businessDayKey(new Date('2026-11-17T02:59:59.999Z'), TZ)).toBe('2026-11-16');
  });

  it('startOfBusinessDay devolve 03:00Z para São Paulo', () => {
    expect(startOfBusinessDay('2026-11-16', TZ).toISOString()).toBe('2026-11-16T03:00:00.000Z');
  });

  it('businessDayRange cobre exatamente o dia local', () => {
    const { start, endExclusive } = businessDayRange('2026-11-16', TZ);
    expect(start.toISOString()).toBe('2026-11-16T03:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-11-17T03:00:00.000Z');
  });

  it('addDaysToDayKey cruza mês e ano', () => {
    expect(addDaysToDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDayKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejeita data inexistente e fuso inválido', () => {
    expect(() => startOfBusinessDay('2026-02-30', TZ)).toThrow();
    expect(() => startOfBusinessDay('16/11/2026', TZ)).toThrow();
    expect(() => businessDayKey(new Date(), 'Fuso/Invalido')).toThrow();
  });
});
