// Runs in America/New_York (jest.global-setup.js): days of 23 and 25 hours are covered.

import { describe, expect, it } from '@jest/globals';

import {
  atTime,
  minutesOf,
  nextOccurrence,
  normalizeRepeat,
  occurrenceAt,
  occurrenceOnOrAfter,
  occurrences,
  occurrencesAfter,
  sameRepeat,
  type Repeat,
} from '../recurrence';

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date).getTime();
/** "2026-03-09" for a day, to read failures easily. */
const iso = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const first = (repeat: Repeat, n: number) => {
  const days: string[] = [];
  for (const occurrence of occurrences(repeat)) {
    if (days.length === n) break;
    days.push(iso(occurrence.day));
  }
  return days;
};

const rule = (patch: Partial<Repeat>): Repeat => ({
  every: 1,
  unit: 'day',
  weekdays: [],
  start: day(2026, 1, 1),
  end: { kind: 'never' },
  ...patch,
});

describe('occurrences', () => {
  it('every n days', () => {
    expect(first(rule({ every: 3, start: day(2026, 1, 30) }), 4)).toEqual([
      '2026-01-30',
      '2026-02-02',
      '2026-02-05',
      '2026-02-08',
    ]);
  });

  it('stays on midnight across daylight saving changes', () => {
    // US clocks go forward on 8 March 2026 and back on 1 November 2026
    expect(new Date(day(2026, 1, 1)).getTimezoneOffset()).not.toBe(new Date(day(2026, 7, 1)).getTimezoneOffset());
    for (const occurrence of occurrences(rule({ start: day(2026, 3, 6), end: { kind: 'count', count: 5 } }))) {
      expect(new Date(occurrence.day).getHours()).toBe(0);
    }
    expect(first(rule({ start: day(2026, 10, 31) }), 3)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    // A task at 09:00 is still at 09:00 after the change
    const after = atTime(day(2026, 3, 9), 9 * 60);
    expect(minutesOf(after)).toBe(9 * 60);
  });

  it('weekly on chosen days, starting mid-week', () => {
    // 1 January 2026 is a Thursday; Monday, Wednesday and Friday
    expect(first(rule({ unit: 'week', weekdays: [1, 3, 5] }), 5)).toEqual([
      '2026-01-02',
      '2026-01-05',
      '2026-01-07',
      '2026-01-09',
      '2026-01-12',
    ]);
  });

  it('every 2 weeks counts from the week the series starts in', () => {
    // Weeks run Monday to Sunday: Sunday 4 January is in the first week, Monday 5th in the second
    expect(first(rule({ unit: 'week', every: 2, weekdays: [0, 1] }), 4)).toEqual([
      '2026-01-04',
      '2026-01-12',
      '2026-01-18',
      '2026-01-26',
    ]);
  });

  it('weekly without days falls on the start’s weekday', () => {
    expect(normalizeRepeat(rule({ unit: 'week', weekdays: [] })).weekdays).toEqual([4]);
    expect(first(rule({ unit: 'week', weekdays: [] }), 2)).toEqual(['2026-01-01', '2026-01-08']);
  });

  it('monthly on the 31st uses the last day of shorter months', () => {
    expect(first(rule({ unit: 'month', start: day(2026, 1, 31) }), 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('every 5 months crosses years', () => {
    expect(first(rule({ unit: 'month', every: 5, start: day(2026, 10, 15) }), 3)).toEqual([
      '2026-10-15',
      '2027-03-15',
      '2027-08-15',
    ]);
  });

  it('yearly on 29 February', () => {
    expect(first(rule({ unit: 'year', start: day(2028, 2, 29) }), 5)).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
    ]);
  });

  it('ends after a number of occurrences', () => {
    expect([...occurrences(rule({ end: { kind: 'count', count: 3 } }))].map((o) => o.index)).toEqual([0, 1, 2]);
  });

  it('ends on a date, that day included', () => {
    expect(first(rule({ every: 2, end: { kind: 'on', date: day(2026, 1, 5) } }), 10)).toEqual([
      '2026-01-01',
      '2026-01-03',
      '2026-01-05',
    ]);
  });

  it('an end before the start gives nothing, and does not hang', () => {
    expect(first(rule({ start: day(2026, 6, 1), end: { kind: 'on', date: day(2026, 5, 1) } }), 1)).toEqual([]);
    expect(occurrenceOnOrAfter(rule({ end: { kind: 'on', date: day(2026, 1, 3) } }), day(2027, 1, 1))).toBeNull();
  });
});

describe('finding occurrences', () => {
  const weekly = rule({ unit: 'week', weekdays: [1, 4], end: { kind: 'count', count: 4 } });

  it('the first one on or after a day, with its index', () => {
    expect(occurrenceOnOrAfter(weekly, day(2026, 1, 6))).toEqual({ index: 2, day: day(2026, 1, 8) });
    expect(occurrenceOnOrAfter(weekly, day(2026, 1, 1))).toEqual({ index: 0, day: day(2026, 1, 1) });
    // Four occurrences: 1, 5, 8 and 12 January
    expect(occurrenceOnOrAfter(weekly, day(2026, 1, 13))).toBeNull();
  });

  it('the next one, until the last', () => {
    expect(nextOccurrence(weekly, 0)).toEqual({ index: 1, day: day(2026, 1, 5) });
    expect(nextOccurrence(weekly, 3)).toBeNull();
    expect(occurrenceAt(weekly, 3)?.day).toBe(day(2026, 1, 12));
  });

  it('the ones after, for the widget', () => {
    expect(occurrencesAfter(weekly, 1, 10)).toEqual({
      next: [
        { index: 2, day: day(2026, 1, 8) },
        { index: 3, day: day(2026, 1, 12) },
      ],
      ends: true,
    });
    const daily = rule({});
    const { next, ends } = occurrencesAfter(daily, 0, 3);
    expect(next.map((o) => iso(o.day))).toEqual(['2026-01-02', '2026-01-03', '2026-01-04']);
    expect(ends).toBe(false);
  });
});

describe('normalizeRepeat', () => {
  it('keeps numbers in range and days at midnight', () => {
    const repeat = normalizeRepeat({
      every: 0,
      unit: 'month',
      weekdays: [1, 2],
      start: day(2026, 1, 1) + 5 * 3600_000,
      end: { kind: 'count', count: 5000 },
    });
    expect(repeat).toEqual({ every: 1, unit: 'month', weekdays: [], start: day(2026, 1, 1), end: { kind: 'count', count: 999 } });
  });

  it('compares rules by what they mean', () => {
    expect(sameRepeat(rule({ unit: 'week', weekdays: [3, 1, 3] }), rule({ unit: 'week', weekdays: [1, 3] }))).toBe(true);
    expect(sameRepeat(rule({ every: 2 }), rule({}))).toBe(false);
    expect(sameRepeat(null, null)).toBe(true);
    expect(sameRepeat(rule({}), null)).toBe(false);
  });
});
