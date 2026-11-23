import type { SQLiteDatabase } from 'expo-sqlite';

/** When a pinned note is shown in notifications (ms since epoch); null: always. */
export type PinWindow = { start: number; end: number };

export type Note = {
  id: string;
  title: string;
  body: string;
  /** Shown in notifications (within `window`, if it has one). */
  pinned: boolean;
  window: PinWindow | null;
  /** Shown at the top of the list. */
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

type NoteRow = {
  id: string;
  title: string;
  body: string;
  pinned: number;
  favorite: number;
  pin_start: number | null;
  pin_end: number | null;
  created_at: number;
  updated_at: number;
};

export const DATABASE_VERSION = 9;

/** The tables whose rows can be marked as favorites (all with a `favorite` column, v5; tasks v6). */
export type FavoriteTable = 'notes' | 'links' | 'memos' | 'tasks';

/** Doesn't touch updated_at: marking a favorite isn't an edit. */
export async function setFavorite(db: SQLiteDatabase, table: FavoriteTable, id: string, favorite: boolean) {
  await db.runAsync(`UPDATE ${table} SET favorite = ? WHERE id = ?`, favorite ? 1 : 0, id);
}

/** Runs on open; brings the schema up to DATABASE_VERSION one step at a time. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id         TEXT PRIMARY KEY NOT NULL,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS notes_created_at ON notes (created_at DESC);
    `);
    version = 1;
  }

  if (version === 1) {
    // Notes from before pinning was optional were all pinned, always. The version is bumped in
    // the same transaction, so an interrupted run can't leave the columns added twice.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE notes ADD COLUMN pin_start INTEGER;
        ALTER TABLE notes ADD COLUMN pin_end INTEGER;
        PRAGMA user_version = 2;
      `);
    });
    version = 2;
  }

  if (version === 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS links (
          id         TEXT PRIMARY KEY NOT NULL,
          url        TEXT NOT NULL,
          title      TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS links_created_at ON links (created_at DESC);
        PRAGMA user_version = 3;
      `);
    });
    version = 3;
  }

  if (version === 3) {
    // Notes page (plain notes, never in notifications); see memos-db.ts
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS memos (
          id         TEXT PRIMARY KEY NOT NULL,
          title      TEXT NOT NULL,
          body       TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memos_updated_at ON memos (updated_at DESC);
        PRAGMA user_version = 4;
      `);
    });
    version = 4;
  }

  if (version === 4) {
    // Favorites, shown at the top of each list
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE notes ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE links ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE memos ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
        PRAGMA user_version = 5;
      `);
    });
    version = 5;
  }

  if (version === 5) {
    // Tasks page (to-dos, with optional due times and repeat rules); see tasks-db.ts
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id           TEXT PRIMARY KEY NOT NULL,
          title        TEXT NOT NULL,
          body         TEXT NOT NULL DEFAULT '',
          due_at       INTEGER,
          repeat       TEXT,
          repeat_index INTEGER NOT NULL DEFAULT 0,
          completed_at INTEGER,
          favorite     INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tasks_due_at ON tasks (completed_at, due_at);
        PRAGMA user_version = 6;
      `);
    });
    version = 6;
  }

  if (version === 6) {
    // Task reminders: minutes before the due time, NULL for none (tasks from before had none)
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE tasks ADD COLUMN reminder INTEGER;
        PRAGMA user_version = 7;
      `);
    });
    version = 7;
  }

  if (version === 7) {
    // History of a repeating task: one row per occurrence checked off (the task itself moves on)
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS task_completions (
          id           TEXT PRIMARY KEY NOT NULL,
          task_id      TEXT NOT NULL,
          occurrence   INTEGER NOT NULL,
          due_at       INTEGER NOT NULL,
          completed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS task_completions_task ON task_completions (task_id, occurrence);
        PRAGMA user_version = 8;
      `);
    });
    version = 8;
  }

  if (version === 8) {
    // Labels on the Notes page: a name and a color each, at most one per note (memos-db.ts)
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS memo_labels (
          id         TEXT PRIMARY KEY NOT NULL,
          name       TEXT NOT NULL,
          color      TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        ALTER TABLE memos ADD COLUMN label_id TEXT;
        PRAGMA user_version = 9;
      `);
    });
    version = 9;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const fromRow = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  pinned: row.pinned !== 0,
  window: row.pin_start !== null && row.pin_end !== null ? { start: row.pin_start, end: row.pin_end } : null,
  favorite: row.favorite !== 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listNotes(db: SQLiteDatabase): Promise<Note[]> {
  const rows = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY created_at DESC');
  return rows.map(fromRow);
}

export async function insertNote(db: SQLiteDatabase, note: Note): Promise<void> {
  await db.runAsync(
    `INSERT INTO notes (id, title, body, pinned, favorite, pin_start, pin_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.title,
    note.body,
    note.pinned ? 1 : 0,
    note.favorite ? 1 : 0,
    note.window?.start ?? null,
    note.window?.end ?? null,
    note.createdAt,
    note.updatedAt,
  );
}

export async function updateNote(db: SQLiteDatabase, note: Note): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET title = ?, body = ?, pinned = ?, pin_start = ?, pin_end = ?, updated_at = ? WHERE id = ?',
    note.title,
    note.body,
    note.pinned ? 1 : 0,
    note.window?.start ?? null,
    note.window?.end ?? null,
    note.updatedAt,
    note.id,
  );
}

export async function setNotePinned(db: SQLiteDatabase, id: string, pinned: boolean, updatedAt: number): Promise<void> {
  await db.runAsync('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?', pinned ? 1 : 0, updatedAt, id);
}

export async function deleteNote(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
