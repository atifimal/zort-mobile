/**
 * What happens to tasks: where a new or edited one's series stands, what completing one does,
 * and how the list is grouped. Pure logic (no React, no database, no i18n), tested in
 * task-logic.test.ts.
 */
import {
  addDays,
  atTime,
  minutesOf,
  nextOccurrence,
  normalizeRepeat,
  occurrenceAt,
  occurrenceOnOrAfter,
  occurrencesAfter,
  sameRepeat,
  startOfDay,
  type Repeat,
} from './recurrence';
import type { Task } from './tasks-db';

export type TaskInput = {
  title: string;
  body: string;
  due: number | null;
  repeat: Repeat | null;
  /** Minutes before the due time; null: none. Ignored without a due time. */
  reminder: number | null;
};

export type Schedule = Pick<Task, 'due' | 'repeat' | 'occurrence'>;

/** The reminders a task can have, in minutes before its due time. */
export const REMINDER_CHOICES: readonly number[] = [0, 5, 15, 30, 60, 24 * 60];

/**
 * Where a task saved with `input` is due. Without a rule, at `input.due`. With one, at the
 * time of day of `input.due`, on the series' first occurrence from today on (or from its start,
 * if that's later): a series started in the past doesn't bring back days already gone. An edit
 * that keeps the rule keeps the occurrence the task is on. Null: the series has no occurrence
 * left (it ends before today).
 */
export function scheduleTask(input: Pick<TaskInput, 'due' | 'repeat'>, now: number, existing?: Task): Schedule | null {
  if (input.due === null) return { due: null, repeat: null, occurrence: 0 };
  if (!input.repeat) return { due: input.due, repeat: null, occurrence: 0 };

  const repeat = normalizeRepeat(input.repeat);
  const minutes = minutesOf(input.due);
  const keep =
    existing &&
    existing.completedAt === null &&
    existing.due !== null &&
    sameRepeat(existing.repeat, repeat)
      ? occurrenceAt(repeat, existing.occurrence)
      : null;
  const occurrence = keep ?? occurrenceOnOrAfter(repeat, Math.max(repeat.start, startOfDay(now)));
  if (!occurrence) return null;
  return { due: atTime(occurrence.day, minutes), repeat, occurrence: occurrence.index };
}

/**
 * The task after it's checked off at `now`. One that repeats moves to its next occurrence, or,
 * if it's behind (a daily task left for three days), to the first one from today on: the days
 * missed are skipped, not queued up. Once the series is over, it's done.
 */
export function completeTask(task: Task, now: number): Task {
  if (task.repeat && task.due !== null) {
    const today = startOfDay(now);
    let next = nextOccurrence(task.repeat, task.occurrence);
    if (next && next.day < today) next = occurrenceOnOrAfter(task.repeat, today);
    if (next) {
      return { ...task, due: atTime(next.day, minutesOf(task.due)), occurrence: next.index, updatedAt: now };
    }
  }
  return { ...task, completedAt: now, updatedAt: now };
}

export const isDone = (task: Task) => task.completedAt !== null;

export type TaskSection = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'someday' | 'done';

export const SECTION_ORDER: readonly TaskSection[] = ['overdue', 'today', 'tomorrow', 'upcoming', 'someday', 'done'];

/** The group a task is listed in. Overdue means due on an earlier day; later today is "today". */
export function sectionOf(task: Task, now: number): TaskSection {
  if (task.completedAt !== null) return 'done';
  if (task.due === null) return 'someday';
  const today = startOfDay(now);
  const day = startOfDay(task.due);
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  return 'upcoming';
}

/** Due today at a time that has passed: still in Today, but shown as late. */
export const isLate = (task: Task, now: number) => task.completedAt === null && task.due !== null && task.due < now;

function compare(a: Task, b: Task): number {
  if (a.completedAt !== null || b.completedAt !== null) return (b.completedAt ?? 0) - (a.completedAt ?? 0);
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  if (a.due !== b.due) return (a.due ?? Infinity) - (b.due ?? Infinity);
  return b.createdAt - a.createdAt;
}

/**
 * The list, in groups: each one's favorites first, then by due time (soonest first), then
 * newest first. Done tasks: the most recently completed first. Empty groups are left out.
 */
export function groupTasks(tasks: readonly Task[], now: number): { section: TaskSection; tasks: Task[] }[] {
  const groups = new Map<TaskSection, Task[]>();
  for (const task of tasks) {
    const section = sectionOf(task, now);
    groups.set(section, [...(groups.get(section) ?? []), task]);
  }
  return SECTION_ORDER.filter((section) => groups.has(section)).map((section) => ({
    section,
    tasks: [...(groups.get(section) ?? [])].sort(compare),
  }));
}

/** The next moment the grouping or a "late" mark changes: the next midnight or due time. */
export function nextTaskChange(tasks: readonly Task[], now: number): number {
  let next = addDays(startOfDay(now), 1);
  for (const task of tasks) {
    if (task.completedAt === null && task.due !== null && task.due > now && task.due < next) next = task.due;
  }
  return next;
}

/**
 * What the widget gets for a task still to do. A repeating one carries its next occurrences, so
 * checking it off on the widget can move it on without the app running.
 */
export type WidgetTask = {
  id: string;
  title: string;
  body: string;
  due: number | null;
  /** Minutes before `due` (and each of `upcoming`) to remind; null: none. */
  reminder: number | null;
  repeats: boolean;
  createdAt: number;
  /** The next occurrences after this one, in order: their due times and indexes. */
  upcoming: { due: number; occurrence: number }[];
  /** Whether the series ends with `upcoming` (false: it goes on beyond them). */
  ends: boolean;
};

const WIDGET_UPCOMING = 30;

export function widgetTask(task: Task): WidgetTask {
  const repeating = task.repeat !== null && task.due !== null;
  const after = repeating ? occurrencesAfter(task.repeat!, task.occurrence, WIDGET_UPCOMING) : { next: [], ends: true };
  const minutes = task.due === null ? 0 : minutesOf(task.due);
  return {
    id: task.id,
    title: task.title,
    body: task.body,
    due: task.due,
    reminder: task.due === null ? null : task.reminder,
    repeats: repeating,
    createdAt: task.createdAt,
    upcoming: after.next.map((occurrence) => ({ due: atTime(occurrence.day, minutes), occurrence: occurrence.index })),
    ends: after.ends,
  };
}
