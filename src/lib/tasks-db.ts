import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizeRepeat, type Repeat } from './recurrence';

/**
 * A to-do (the Tasks page, "Görevler"): a title, an optional description and due time, and an
 * optional repeat rule. A repeating task is one row: completing it moves it to its next
 * occurrence (`due` and `occurrence` advance) until the series ends; only then is it done.
 */
export type Task = {
  id: string;
  title: string;
  body: string;
  /** When it's due (ms since epoch); null: no date. A repeating task always has one. */
  due: number | null;
  repeat: Repeat | null;
  /** Which occurrence of the series `due` is (0: the first); 0 for tasks that don't repeat. */
  occurrence: number;
  /** When it was completed; null: still to do. */
  completedAt: number | null;
  /** Shown first in its group. */
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

type TaskRow = {
  id: string;
  title: string;
  body: string;
  due_at: number | null;
  repeat: string | null;
  repeat_index: number;
  completed_at: number | null;
  favorite: number;
  created_at: number;
  updated_at: number;
};

/** The repeat column holds the rule as JSON; anything unreadable counts as no rule. */
function parseRepeat(text: string | null): Repeat | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Repeat;
    const units = ['day', 'week', 'month', 'year'];
    if (typeof value !== 'object' || value === null || !units.includes(value.unit)) return null;
    if (typeof value.start !== 'number' || typeof value.every !== 'number') return null;
    return normalizeRepeat({
      ...value,
      weekdays: Array.isArray(value.weekdays) ? value.weekdays : [],
      end: value.end && typeof value.end === 'object' ? value.end : { kind: 'never' },
    });
  } catch {
    return null;
  }
}

const fromRow = (row: TaskRow): Task => {
  const repeat = parseRepeat(row.repeat);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    due: row.due_at,
    // A rule without a due time can't be followed; the task is kept as a plain one
    repeat: row.due_at === null ? null : repeat,
    occurrence: repeat && row.due_at !== null ? row.repeat_index : 0,
    completedAt: row.completed_at,
    favorite: row.favorite !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const repeatText = (task: Task) => (task.repeat ? JSON.stringify(normalizeRepeat(task.repeat)) : null);

export async function listTasks(db: SQLiteDatabase): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows.map(fromRow);
}

export async function insertTask(db: SQLiteDatabase, task: Task): Promise<void> {
  await db.runAsync(
    `INSERT INTO tasks (id, title, body, due_at, repeat, repeat_index, completed_at, favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    task.id,
    task.title,
    task.body,
    task.due,
    repeatText(task),
    task.occurrence,
    task.completedAt,
    task.favorite ? 1 : 0,
    task.createdAt,
    task.updatedAt,
  );
}

/** Everything but `favorite` and `created_at` (a favorite isn't an edit; see setFavorite). */
export async function updateTask(db: SQLiteDatabase, task: Task): Promise<void> {
  await db.runAsync(
    `UPDATE tasks SET title = ?, body = ?, due_at = ?, repeat = ?, repeat_index = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
    task.title,
    task.body,
    task.due,
    repeatText(task),
    task.occurrence,
    task.completedAt,
    task.updatedAt,
    task.id,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

export async function deleteCompletedTasks(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE completed_at IS NOT NULL');
}
