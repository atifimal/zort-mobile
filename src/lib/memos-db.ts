import type { SQLiteDatabase } from 'expo-sqlite';

import { toLabelColor, type LabelColor } from './label-colors';

/**
 * A note on the Notes page: a title and a description, kept in the app only. Called a memo in
 * the code so it isn't confused with Pin Note's `Note`, which lives in notifications.
 */
export type Memo = {
  id: string;
  title: string;
  body: string;
  /** Its label (a MemoLabel's id), if it has one; the card takes the label's color. */
  labelId: string | null;
  /** Shown at the top of the list. */
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

/** A label for the Notes page's notes: a name and a color. */
export type MemoLabel = { id: string; name: string; color: LabelColor; createdAt: number };

type MemoRow = {
  id: string;
  title: string;
  body: string;
  label_id: string | null;
  favorite: number;
  created_at: number;
  updated_at: number;
};

type LabelRow = { id: string; name: string; color: string; created_at: number };

const fromRow = (row: MemoRow): Memo => ({
  id: row.id,
  title: row.title,
  body: row.body,
  labelId: row.label_id,
  favorite: row.favorite !== 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Most recently edited first. */
export async function listMemos(db: SQLiteDatabase): Promise<Memo[]> {
  const rows = await db.getAllAsync<MemoRow>('SELECT * FROM memos ORDER BY updated_at DESC');
  return rows.map(fromRow);
}

export async function insertMemo(db: SQLiteDatabase, memo: Memo): Promise<void> {
  await db.runAsync(
    'INSERT INTO memos (id, title, body, label_id, favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    memo.id,
    memo.title,
    memo.body,
    memo.labelId,
    memo.favorite ? 1 : 0,
    memo.createdAt,
    memo.updatedAt,
  );
}

export async function updateMemo(db: SQLiteDatabase, memo: Memo): Promise<void> {
  await db.runAsync(
    'UPDATE memos SET title = ?, body = ?, label_id = ?, updated_at = ? WHERE id = ?',
    memo.title,
    memo.body,
    memo.labelId,
    memo.updatedAt,
    memo.id,
  );
}

export async function deleteMemo(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM memos WHERE id = ?', id);
}

/** In the order they were added. */
export async function listMemoLabels(db: SQLiteDatabase): Promise<MemoLabel[]> {
  const rows = await db.getAllAsync<LabelRow>('SELECT * FROM memo_labels ORDER BY created_at, name');
  return rows.map((row) => ({ id: row.id, name: row.name, color: toLabelColor(row.color), createdAt: row.created_at }));
}

export async function insertMemoLabel(db: SQLiteDatabase, label: MemoLabel): Promise<void> {
  await db.runAsync(
    'INSERT INTO memo_labels (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    label.id,
    label.name,
    label.color,
    label.createdAt,
  );
}

export async function updateMemoLabel(db: SQLiteDatabase, label: MemoLabel): Promise<void> {
  await db.runAsync('UPDATE memo_labels SET name = ?, color = ? WHERE id = ?', label.name, label.color, label.id);
}

/** Its notes stay, without a label; that isn't an edit of them (updated_at is unchanged). */
export async function deleteMemoLabel(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE memos SET label_id = NULL WHERE label_id = ?', id);
    await db.runAsync('DELETE FROM memo_labels WHERE id = ?', id);
  });
}
