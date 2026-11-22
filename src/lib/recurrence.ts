/**
 * Repeating tasks: which days a rule falls on. Pure logic (no React, no database, no i18n), so
 * it can be tested on its own (recurrence.test.ts) and runs the same in the app and for the
 * widget's upcoming dates.
 *
 * Days are local midnights (ms since epoch) and all arithmetic goes through the local calendar
 * (new Date(y, m, d)), never by adding 24 h: a day across a daylight saving change is 23 or 25 h.
 */

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export type RepeatEnd =
  | { kind: 'never' }
  /** The last day an occurrence may fall on (local midnight). */
  | { kind: 'on'; date: number }
  /** How many occurrences there are in all, the first one included. */
  | { kind: 'count'; count: number };

export type Repeat = {
  /** Every `every` units: every 2 weeks, every 3 months. */
  every: number;
  unit: RepeatUnit;
  /** For weekly rules: the days of the week (0 = Sunday … 6 = Saturday). Ignored otherwise. */
  weekdays: number[];
  /** The first day of the series (local midnight). Monthly and yearly rules keep its date. */
  start: number;
  end: RepeatEnd;
};

/** One date of a series: the `index`-th occurrence (0 is the first), on `day`. */
export type Occurrence = { index: number; day: number };

export const MAX_EVERY = 99;
export const MAX_COUNT = 999;

// A series that never produces a day that passes its filters (an end before the start, say)
// must not loop forever: no rule needs more steps than this (every day for ~270 years)
const STEP_LIMIT = 100_000;

export function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function addDays(day: number, days: number): number {
  const date = new Date(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

export const weekdayOf = (day: number) => new Date(day).getDay();

/** Minutes after midnight of a time: the time of day a task is due. */
export function minutesOf(time: number): number {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

/** `day` at `minutes` after midnight, local time. */
export function atTime(day: number, minutes: number): number {
  const date = new Date(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
}

/** The `date`th of a month, or its last day if it's shorter (the 31st in April is the 30th). */
function dayInMonth(year: number, month: number, date: number): number {
  const normalizedYear = year + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const length = new Date(normalizedYear, normalizedMonth + 1, 0).getDate();
  return new Date(normalizedYear, normalizedMonth, Math.min(date, length)).getTime();
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));

/** A rule as it's stored: whole numbers in range, days at midnight, weekly rules with a day. */
export function normalizeRepeat(repeat: Repeat): Repeat {
  const start = startOfDay(repeat.start);
  const weekdays = [...new Set(repeat.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  const end: RepeatEnd =
    repeat.end.kind === 'on'
      ? { kind: 'on', date: startOfDay(repeat.end.date) }
      : repeat.end.kind === 'count'
        ? { kind: 'count', count: clamp(repeat.end.count, 1, MAX_COUNT) }
        : { kind: 'never' };
  return {
    every: clamp(repeat.every, 1, MAX_EVERY),
    unit: repeat.unit,
    weekdays: repeat.unit === 'week' ? (weekdays.length > 0 ? weekdays : [weekdayOf(start)]) : [],
    start,
    end,
  };
}

export function sameRepeat(a: Repeat | null, b: Repeat | null): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify(normalizeRepeat(a)) === JSON.stringify(normalizeRepeat(b));
}

/** Every day the rule falls on from its start, in order, ignoring its end. Never ends by itself. */
function* ruleDays(repeat: Repeat): Generator<number> {
  const { every, unit, start } = repeat;
  const first = new Date(start);

  if (unit === 'day') {
    for (let step = 0; ; step++) yield addDays(start, step * every);
  }

  if (unit === 'week') {
    // Weeks run Monday to Sunday; "every 2 weeks" counts from the week the series starts in
    const monday = addDays(start, -((weekdayOf(start) + 6) % 7));
    const offsets = repeat.weekdays.map((day) => (day + 6) % 7).sort((a, b) => a - b);
    for (let week = 0; ; week += every) {
      for (const offset of offsets) {
        const day = addDays(monday, week * 7 + offset);
        if (day >= start) yield day;
      }
    }
  }

  if (unit === 'month') {
    for (let step = 0; ; step++) yield dayInMonth(first.getFullYear(), first.getMonth() + step * every, first.getDate());
  }

  // Yearly: the same date, so a series started on 29 February falls on the 28th in other years
  for (let step = 0; ; step++) yield dayInMonth(first.getFullYear() + step * every, first.getMonth(), first.getDate());
}

/** The series: every occurrence, in order, up to its end. */
export function* occurrences(rule: Repeat): Generator<Occurrence> {
  const repeat = normalizeRepeat(rule);
  let index = 0;
  let steps = 0;
  for (const day of ruleDays(repeat)) {
    if (++steps > STEP_LIMIT) return;
    if (repeat.end.kind === 'on' && day > repeat.end.date) return;
    if (repeat.end.kind === 'count' && index >= repeat.end.count) return;
    yield { index, day };
    index++;
  }
}

/** The first occurrence on `day` or later; null if the series is over by then. */
export function occurrenceOnOrAfter(repeat: Repeat, day: number): Occurrence | null {
  const from = startOfDay(day);
  for (const occurrence of occurrences(repeat)) {
    if (occurrence.day >= from) return occurrence;
  }
  return null;
}

export function occurrenceAt(repeat: Repeat, index: number): Occurrence | null {
  for (const occurrence of occurrences(repeat)) {
    if (occurrence.index === index) return occurrence;
    if (occurrence.index > index) return null;
  }
  return null;
}

/** The occurrence after the `index`-th; null if that was the last. */
export const nextOccurrence = (repeat: Repeat, index: number) => occurrenceAt(repeat, index + 1);

/**
 * Up to `limit` occurrences after the `index`-th, and whether the series ends with them
 * (false: there are more than `limit`).
 */
export function occurrencesAfter(repeat: Repeat, index: number, limit: number): { next: Occurrence[]; ends: boolean } {
  const next: Occurrence[] = [];
  for (const occurrence of occurrences(repeat)) {
    if (occurrence.index <= index) continue;
    if (next.length === limit) return { next, ends: false };
    next.push(occurrence);
  }
  return { next, ends: true };
}
