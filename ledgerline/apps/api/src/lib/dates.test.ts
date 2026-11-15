import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  addDays,
  dayOfWeek,
  endOfMonth,
  fromEpochDay,
  normaliseBusinessDate,
  shiftMonthEnd,
  toEpochDay,
} from './dates';

describe('business dates', () => {
  it('round-trips epoch days', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    for (const d of ['2024-02-29', '2026-11-14', '1999-12-31', '2000-03-01']) {
      expect(fromEpochDay(toEpochDay(d))).toBe(d);
    }
  });

  it('knows weekdays and crosses month, year and leap boundaries', () => {
    expect(dayOfWeek('2026-11-14')).toBe(6); // Saturday
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('t+2 on a Friday is Tuesday, and skips holidays', () => {
    expect(addBusinessDays('2026-11-13', 2)).toBe('2026-11-17');
    expect(addBusinessDays('2026-11-13', 2, new Set(['2026-11-16']))).toBe('2026-11-18');
    expect(addBusinessDays('2026-11-16', -1)).toBe('2026-11-13');
  });

  it('finds month ends', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(shiftMonthEnd('2026-11-14', -1)).toBe('2026-10-31');
    expect(shiftMonthEnd('2026-11-14', -11)).toBe('2025-12-31');
  });

  it('converts legacy placeholders to null', () => {
    for (const d of ['1900-01-01', '9999-12-31', '0001-01-01', '9999-12-31T00:00:00Z', '', null, undefined]) {
      expect(normaliseBusinessDate(d)).toBeNull();
    }
    expect(normaliseBusinessDate('2026-11-13')).toBe('2026-11-13');
  });
});
