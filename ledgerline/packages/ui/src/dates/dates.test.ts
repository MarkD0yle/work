import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  addMonths,
  adjustToBusinessDay,
  dayOfWeek,
  endOfMonth,
  fromEpochDay,
  isValidIso,
  toEpochDay,
} from './calendar';
import { formatBusinessDate, formatIsoDateLong, formatPeriod } from './format';
import { parseDateInput } from './parse';

const FRIDAY = '2026-11-13';
const US = new Set(['2026-11-11', '2026-11-26', '2026-12-25']);
const parse = (text: string, today = FRIDAY, holidays = US, order: 'dmy' | 'mdy' = 'dmy') =>
  parseDateInput(text, { today, holidays, order });

describe('calendar maths', () => {
  it('round-trips and knows weekdays without ever using Date', () => {
    for (const d of ['1970-01-01', '2024-02-29', '2026-11-14', '1999-12-31'])
      expect(fromEpochDay(toEpochDay(d))).toBe(d);
    expect(dayOfWeek(FRIDAY)).toBe(5);
    expect(isValidIso('2026-02-29')).toBe(false);
    expect(isValidIso('2024-02-29')).toBe(true);
    expect(isValidIso('2026-13-01')).toBe(false);
  });

  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-13', -1)).toBe('2026-10-13');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
  });

  it('applies business-day rules', () => {
    const sat = '2026-11-14';
    expect(adjustToBusinessDay(sat, 'following', US)).toBe('2026-11-16');
    expect(adjustToBusinessDay(sat, 'preceding', US)).toBe('2026-11-13');
    expect(adjustToBusinessDay(sat, 'none', US)).toBe(sat);
    expect(adjustToBusinessDay(FRIDAY, 'following', US)).toBe(FRIDAY);
    // Sat 31 Oct: following would be 2 Nov (next month), so modified following rolls back to Fri 30 Oct.
    expect(adjustToBusinessDay('2026-10-31', 'following', US)).toBe('2026-11-02');
    expect(adjustToBusinessDay('2026-10-31', 'modifiedFollowing', US)).toBe('2026-10-30');
    // A holiday is not a business day.
    expect(adjustToBusinessDay('2026-11-26', 'following', US)).toBe('2026-11-27');
  });
});

describe('parseDateInput', () => {
  it('t+2 on a Friday trade resolves to Tuesday, using the calendar', () => {
    expect(parse('t+2')).toEqual({ ok: true, value: '2026-11-17', shortcut: true });
    // With Monday a holiday in the portfolio's calendar, t+2 is Wednesday.
    expect(parse('t+2', FRIDAY, new Set(['2026-11-16']))).toMatchObject({ value: '2026-11-18' });
    // Thanksgiving (Thu 26 Nov) is skipped.
    expect(parse('t+1', '2026-11-25')).toMatchObject({ value: '2026-11-27' });
    expect(addBusinessDays(FRIDAY, 2, US)).toBe('2026-11-17');
  });

  it.each([
    ['t', '2026-11-13'],
    ['today', '2026-11-13'],
    ['T-1', '2026-11-12'],
    ['t - 3', '2026-11-09'],
    ['-1m', '2026-10-13'],
    ['+1y', '2027-11-13'],
    ['+3d', '2026-11-16'],
    ['-1w', '2026-11-06'],
    ['eom', '2026-11-30'],
    ['som', '2026-11-01'],
  ])('shortcut %s -> %s', (text, value) => {
    expect(parse(text)).toEqual({ ok: true, value, shortcut: true });
  });

  it.each([
    ['2026-11-13', '2026-11-13'],
    ['2026-1-5', '2026-01-05'],
    ['20261113', '2026-11-13'],
    ['13 Nov 2026', '2026-11-13'],
    ['13-nov-26', '2026-11-13'],
    ['5 november 2026', '2026-11-05'],
    ['13/11/2026', '2026-11-13'],
    ['03.04.26', '2026-04-03'],
  ])('typed %s -> %s', (text, value) => {
    expect(parse(text)).toEqual({ ok: true, value, shortcut: false });
  });

  it('reads all-numeric dates month first only when the locale says so', () => {
    expect(parse('03/04/2026')).toMatchObject({ value: '2026-04-03' });
    expect(parse('03/04/2026', FRIDAY, US, 'mdy')).toMatchObject({ value: '2026-03-04' });
  });

  it('empty is no date, not an error', () => {
    for (const text of ['', '  ', '—'])
      expect(parse(text)).toEqual({ ok: true, value: null, shortcut: false });
  });

  it.each(['31/02/2026', '2026-13-01', 'tomorrow', 't+', '13 Foo 2026', '99999999'])(
    'rejects %s with help',
    (text) => {
      const result = parse(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/t\+2/);
    },
  );
});

describe('formatting', () => {
  it('is day-first with the month as a word', () => {
    expect(formatBusinessDate({ value: FRIDAY, basis: 'trade' })).toBe('13 Nov 2026');
    expect(formatBusinessDate({ value: null, basis: 'settle' })).toBe('—');
    expect(formatIsoDateLong('2026-11-17')).toBe('Tue 17 Nov 2026');
    expect(formatPeriod('2026-10-31')).toBe('Oct 2026');
  });
});
