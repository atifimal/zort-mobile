import type { Note, PinWindow } from './db';
import { language } from './i18n';

/**
 * Where a note stands with notifications:
 * - off: not pinned
 * - always: pinned, shown all the time
 * - upcoming: pinned, its window hasn't started
 * - active: pinned, inside its window
 * - ended: pinned, its window is over
 */
export type PinStatus = 'off' | 'always' | 'upcoming' | 'active' | 'ended';

export function pinStatus(note: Pick<Note, 'pinned' | 'window'>, now: number): PinStatus {
  if (!note.pinned) return 'off';
  if (!note.window) return 'always';
  if (now < note.window.start) return 'upcoming';
  if (now < note.window.end) return 'active';
  return 'ended';
}

/** In the notification shade right now (permission aside). */
export const isShown = (note: Note, now: number) => {
  const status = pinStatus(note, now);
  return status === 'always' || status === 'active';
};

/** The next moment any note's status changes, so the screens can update then. */
export function nextStatusChange(notes: Note[], now: number): number | null {
  let next: number | null = null;
  for (const note of notes) {
    if (!note.pinned || !note.window) continue;
    for (const time of [note.window.start, note.window.end]) {
      if (time > now && (next === null || time < next)) next = time;
    }
  }
  return next;
}

/** A new window: from now (to the minute) for a day. */
export function defaultWindow(now: number): PinWindow {
  const start = Math.floor(now / 60_000) * 60_000;
  return { start, end: start + 24 * 60 * 60_000 };
}

const sameYear = new Intl.DateTimeFormat(language, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const otherYear = new Intl.DateTimeFormat(language, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Short date and time in the app's language; the year only when it isn't this year. */
export function formatDateTime(time: number): string {
  const date = new Date(time);
  return (date.getFullYear() === new Date().getFullYear() ? sameYear : otherYear).format(date);
}
