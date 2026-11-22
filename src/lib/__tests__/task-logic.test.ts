import { describe, expect, it } from '@jest/globals';

import type { Repeat } from '../recurrence';
import { completeTask, groupTasks, isLate, nextTaskChange, scheduleTask, sectionOf, widgetTask } from '../task-logic';
import type { Task } from '../tasks-db';

const at = (year: number, month: number, date: number, hours = 0, minutes = 0) =>
  new Date(year, month - 1, date, hours, minutes).getTime();

const task = (patch: Partial<Task>): Task => ({
  id: 't',
  title: 'Task',
  body: '',
  due: null,
  repeat: null,
  occurrence: 0,
  completedAt: null,
  reminder: null,
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const daily = (patch: Partial<Repeat> = {}): Repeat => ({
  every: 1,
  unit: 'day',
  weekdays: [],
  start: at(2026, 3, 1),
  end: { kind: 'never' },
  ...patch,
});

// Tuesday 10 March 2026, 12:00
const NOW = at(2026, 3, 10, 12);

describe('scheduleTask', () => {
  it('keeps a plain due time as it is', () => {
    expect(scheduleTask({ due: at(2026, 3, 1, 9), repeat: null }, NOW)).toEqual({
      due: at(2026, 3, 1, 9),
      repeat: null,
      occurrence: 0,
    });
    expect(scheduleTask({ due: null, repeat: daily() }, NOW)).toEqual({ due: null, repeat: null, occurrence: 0 });
  });

  it('a series started in the past begins today, at the chosen time', () => {
    expect(scheduleTask({ due: at(2026, 3, 1, 9, 30), repeat: daily() }, NOW)).toMatchObject({
      due: at(2026, 3, 10, 9, 30),
      occurrence: 9,
    });
  });

  it('a series starting later begins on its first day that matches', () => {
    // Saturday 14 March; Mondays and Wednesdays
    const repeat = daily({ unit: 'week', weekdays: [1, 3], start: at(2026, 3, 14) });
    expect(scheduleTask({ due: at(2026, 3, 10, 8), repeat }, NOW)).toMatchObject({ due: at(2026, 3, 16, 8), occurrence: 0 });
  });

  it('a series that is already over has nowhere to go', () => {
    expect(scheduleTask({ due: at(2026, 3, 10, 8), repeat: daily({ end: { kind: 'count', count: 3 } }) }, NOW)).toBeNull();
  });

  it('an edit that keeps the rule keeps the occurrence, and can change the time', () => {
    const existing = task({ due: at(2026, 3, 12, 9), repeat: daily(), occurrence: 11 });
    expect(scheduleTask({ due: at(2026, 3, 12, 18), repeat: daily() }, NOW, existing)).toMatchObject({
      due: at(2026, 3, 12, 18),
      occurrence: 11,
    });
  });

  it('an edit that changes the rule starts it again from today', () => {
    const existing = task({ due: at(2026, 3, 12, 9), repeat: daily(), occurrence: 11 });
    expect(scheduleTask({ due: at(2026, 3, 12, 9), repeat: daily({ every: 2 }) }, NOW, existing)).toMatchObject({
      due: at(2026, 3, 11, 9),
      occurrence: 5,
    });
  });
});

describe('completeTask', () => {
  it('a plain task is done', () => {
    expect(completeTask(task({ due: at(2026, 3, 10, 9) }), NOW)).toMatchObject({ completedAt: NOW, updatedAt: NOW });
  });

  it('a repeating task moves to its next occurrence, at the same time', () => {
    const done = completeTask(task({ due: at(2026, 3, 10, 9), repeat: daily({ every: 2, start: at(2026, 3, 10) }) }), NOW);
    expect(done).toMatchObject({ due: at(2026, 3, 12, 9), occurrence: 1, completedAt: null });
  });

  it('skips the days missed when it is behind', () => {
    // Due on the 7th, checked off on the 10th: next is today, not the 8th
    const late = task({ due: at(2026, 3, 7, 9), repeat: daily(), occurrence: 6 });
    expect(completeTask(late, NOW)).toMatchObject({ due: at(2026, 3, 10, 9), occurrence: 9 });
  });

  it('the last occurrence finishes the series', () => {
    const last = task({ due: at(2026, 3, 3, 9), repeat: daily({ end: { kind: 'count', count: 3 } }), occurrence: 2 });
    expect(completeTask(last, NOW)).toMatchObject({ completedAt: NOW, due: at(2026, 3, 3, 9) });
  });

  it('a series whose remaining days are all past is done', () => {
    const behind = task({ due: at(2026, 3, 1, 9), repeat: daily({ end: { kind: 'on', date: at(2026, 3, 5) } }) });
    expect(completeTask(behind, NOW).completedAt).toBe(NOW);
  });
});

describe('grouping', () => {
  const list = [
    task({ id: 'someday' }),
    task({ id: 'overdue', due: at(2026, 3, 9, 23) }),
    task({ id: 'late', due: at(2026, 3, 10, 8) }),
    task({ id: 'tonight', due: at(2026, 3, 10, 20) }),
    task({ id: 'favorite', due: at(2026, 3, 10, 22), favorite: true }),
    task({ id: 'tomorrow', due: at(2026, 3, 11, 0) }),
    task({ id: 'later', due: at(2026, 4, 1, 9) }),
    task({ id: 'done-old', completedAt: 5 }),
    task({ id: 'done-new', completedAt: 9 }),
  ];

  it('puts each task in its group, in order', () => {
    expect(groupTasks(list, NOW).map(({ section, tasks }) => [section, tasks.map((item) => item.id)])).toEqual([
      ['overdue', ['overdue']],
      ['today', ['favorite', 'late', 'tonight']],
      ['tomorrow', ['tomorrow']],
      ['upcoming', ['later']],
      ['someday', ['someday']],
      ['done', ['done-new', 'done-old']],
    ]);
  });

  it('marks today’s passed times as late', () => {
    expect(isLate(list[2]!, NOW)).toBe(true);
    expect(isLate(list[3]!, NOW)).toBe(false);
    expect(sectionOf(list[2]!, NOW)).toBe('today');
  });

  it('updates at the next due time today, or at midnight', () => {
    expect(nextTaskChange(list, NOW)).toBe(at(2026, 3, 10, 20));
    expect(nextTaskChange([], NOW)).toBe(at(2026, 3, 11));
  });
});

describe('widgetTask', () => {
  it('a repeating task carries its next occurrences', () => {
    const item = widgetTask(task({ due: at(2026, 3, 10, 9), repeat: daily({ end: { kind: 'count', count: 12 } }), occurrence: 9 }));
    expect(item.repeats).toBe(true);
    expect(item.upcoming).toEqual([
      { due: at(2026, 3, 11, 9), occurrence: 10 },
      { due: at(2026, 3, 12, 9), occurrence: 11 },
    ]);
    expect(item.ends).toBe(true);
  });

  it('an endless one carries a few and says there are more', () => {
    const item = widgetTask(task({ due: at(2026, 3, 10, 9), repeat: daily() }));
    expect(item.upcoming).toHaveLength(30);
    expect(item.ends).toBe(false);
  });

  it('a plain task has none', () => {
    expect(widgetTask(task({ due: at(2026, 3, 10, 9) }))).toMatchObject({ repeats: false, upcoming: [], ends: true });
  });
});
