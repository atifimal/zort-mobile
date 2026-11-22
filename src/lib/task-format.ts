import { language, t } from './i18n';
import { addDays, startOfDay, type Repeat } from './recurrence';
import type { TaskSection } from './task-logic';

/** How the tasks' dates and rules read, in the app's language. */

const timeFormat = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat(language, { weekday: 'short' });
const dayFormat = new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatTime = (time: number) => timeFormat.format(new Date(time));

/** "Mon 24 Nov", or "24 Nov 2027" in another year. */
export function formatDay(day: number, now = Date.now()): string {
  const date = new Date(day);
  return (date.getFullYear() === new Date(now).getFullYear() ? dayFormat : dayYearFormat).format(date);
}

/**
 * A due time as it's shown on a task: "Today, 09:00", "Tomorrow, 18:30", "Yesterday, 08:00",
 * "Fri, 09:00" within the coming week, "Mon 24 Nov, 09:00" further out.
 */
export function formatDue(due: number, now = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(due);
  const time = formatTime(due);
  const name =
    day === today
      ? t('today')
      : day === addDays(today, 1)
        ? t('tomorrow')
        : day === addDays(today, -1)
          ? t('yesterday')
          : day > today && day < addDays(today, 7)
            ? weekdayFormat.format(new Date(due))
            : formatDay(day, now);
  return t('dayAndTime', { day: name, time });
}

// 4 January 2026 is a Sunday: the days of the week, 0 (Sunday) to 6
const SUNDAY = new Date(2026, 0, 4).getTime();
export const weekdayName = (weekday: number) => weekdayFormat.format(new Date(addDays(SUNDAY, weekday)));

/** The days of the week in the order the language uses: Monday first, or Sunday first in English. */
export const WEEK_ORDER: readonly number[] = language === 'tr' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

/** "Every 2 weeks on Mon, Wed", "Every month, until 1 Mar 2027", "Every day, 10 times". */
export function describeRepeat(repeat: Repeat, now = Date.now()): string {
  const n = repeat.every;
  const one = n === 1;
  const weekdays = [...repeat.weekdays].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  const isWorkWeek = weekdays.length === 5 && [1, 2, 3, 4, 5].every((day) => weekdays.includes(day));

  let rule: string;
  switch (repeat.unit) {
    case 'day':
      rule = one ? t('repeatDaily') : t('repeatEveryDays', { n });
      break;
    case 'week':
      if (one && weekdays.length === 7) rule = t('repeatDaily');
      else if (one && isWorkWeek) rule = t('repeatWeekdays');
      else
        rule = t('repeatWithDays', {
          rule: one ? t('repeatWeekly') : t('repeatEveryWeeks', { n }),
          days: weekdays.map(weekdayName).join(', '),
        });
      break;
    case 'month':
      rule = one ? t('repeatMonthly') : t('repeatEveryMonths', { n });
      break;
    case 'year':
      rule = one ? t('repeatYearly') : t('repeatEveryYears', { n });
      break;
  }

  if (repeat.end.kind === 'on') return t('repeatUntil', { rule, date: formatDay(repeat.end.date, now) });
  if (repeat.end.kind === 'count') return t('repeatTimes', { rule, n: repeat.end.count });
  return rule;
}

export function sectionTitle(section: TaskSection): string {
  switch (section) {
    case 'overdue':
      return t('sectionOverdue');
    case 'today':
      return t('sectionToday');
    case 'tomorrow':
      return t('sectionTomorrow');
    case 'upcoming':
      return t('sectionUpcoming');
    case 'someday':
      return t('sectionSomeday');
    case 'done':
      return t('sectionDone');
  }
}

/** "At the due time", "15 min before", "1 hour before", "1 day before"; "None" for null. */
export function describeReminder(minutes: number | null): string {
  if (minutes === null) return t('reminderNone');
  if (minutes === 0) return t('reminderAtTime');
  if (minutes === 60) return t('reminderHour');
  if (minutes === 24 * 60) return t('reminderDay');
  return t('reminderMinutes', { n: minutes });
}

/** A new task's due time: the next full hour today, or 09:00 tomorrow if that's past 22:00. */
export function defaultDue(now = Date.now()): number {
  const date = new Date(now);
  if (date.getHours() >= 22) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 9).getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
}
