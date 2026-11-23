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
  /**
   * Minutes before `due` to send a reminder (0: at the due time); null: no reminder. Always null
   * without a due time.
   */
  reminder: number | null;
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
  reminder: number | null;
  // The table still has a `favorite` column (v6), always 0: tasks had favorites until they
  // turned out to change little (they only reordered a date group). Left unused, not dropped.
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
    reminder: row.due_at === null ? null : row.reminder,
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
    `INSERT INTO tasks (id, title, body, due_at, repeat, repeat_index, completed_at, reminder, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    task.id,
    task.title,
    task.body,
    task.due,
    repeatText(task),
    task.occurrence,
    task.completedAt,
    task.reminder,
    task.createdAt,
    task.updatedAt,
  );
}

/** Everything but `created_at`. */
export async function updateTask(db: SQLiteDatabase, task: Task): Promise<void> {
  await db.runAsync(
    `UPDATE tasks SET title = ?, body = ?, due_at = ?, repeat = ?, repeat_index = ?, completed_at = ?, reminder = ?,
     updated_at = ? WHERE id = ?`,
    task.title,
    task.body,
    task.due,
    repeatText(task),
    task.occurrence,
    task.completedAt,
    task.reminder,
    task.updatedAt,
    task.id,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM task_completions WHERE task_id = ?', id);
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

export async function deleteCompletedTasks(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM task_completions');
  await db.runAsync('DELETE FROM tasks WHERE completed_at IS NOT NULL');
}

/**
 * One occurrence of a repeating task that was checked off. The task row itself moves on to its
 * next occurrence, so these rows are what lists those occurrences among the completed ones.
 */
export type TaskCompletion = {
  id: string;
  taskId: string;
  /** Which occurrence of the series was checked off. */
  occurrence: number;
  /** When that occurrence was due. */
  due: number;
  completedAt: number;
};

type TaskCompletionRow = {
  id: string;
  task_id: string;
  occurrence: number;
  due_at: number;
  completed_at: number;
};

export async function listTaskCompletions(db: SQLiteDatabase): Promise<TaskCompletion[]> {
  const rows = await db.getAllAsync<TaskCompletionRow>('SELECT * FROM task_completions ORDER BY completed_at DESC');
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    occurrence: row.occurrence,
    due: row.due_at,
    completedAt: row.completed_at,
  }));
}

export async function insertTaskCompletion(db: SQLiteDatabase, completion: TaskCompletion): Promise<void> {
  await db.runAsync(
    'INSERT INTO task_completions (id, task_id, occurrence, due_at, completed_at) VALUES (?, ?, ?, ?, ?)',
    completion.id,
    completion.taskId,
    completion.occurrence,
    completion.due,
    completion.completedAt,
  );
}

/** The task's completions from `occurrence` on: they're to do again once it's taken back there. */
export async function deleteTaskCompletionsFrom(db: SQLiteDatabase, taskId: string, occurrence: number): Promise<void> {
  await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND occurrence >= ?', taskId, occurrence);
}

/** How many of a repeating task's checked-off occurrences are kept (the most recent ones). */
export const COMPLETIONS_KEPT = 5;

/** Deletes the task's completions beyond the most recent COMPLETIONS_KEPT. */
export async function pruneTaskCompletions(db: SQLiteDatabase, taskId: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM task_completions WHERE task_id = ? AND id NOT IN (
       SELECT id FROM task_completions WHERE task_id = ? ORDER BY occurrence DESC, completed_at DESC LIMIT ?
     )`,
    taskId,
    taskId,
    COMPLETIONS_KEPT,
  );
}
