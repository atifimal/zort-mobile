import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * A note on the Notes page: a title and a description, kept in the app only. Called a memo in
 * the code so it isn't confused with Pin Note's `Note`, which lives in notifications.
 */
export type Memo = {
  id: string;
  title: string;
  body: string;
  /** Shown at the top of the list. */
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

type MemoRow = { id: string; title: string; body: string; favorite: number; created_at: number; updated_at: number };

const fromRow = (row: MemoRow): Memo => ({
  id: row.id,
  title: row.title,
  body: row.body,
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
    'INSERT INTO memos (id, title, body, favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    memo.id,
    memo.title,
    memo.body,
    memo.favorite ? 1 : 0,
    memo.createdAt,
    memo.updatedAt,
  );
}

export async function updateMemo(db: SQLiteDatabase, memo: Memo): Promise<void> {
  await db.runAsync(
    'UPDATE memos SET title = ?, body = ?, updated_at = ? WHERE id = ?',
    memo.title,
    memo.body,
    memo.updatedAt,
    memo.id,
  );
}

export async function deleteMemo(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM memos WHERE id = ?', id);
}
