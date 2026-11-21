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
  createdAt: number;
  updatedAt: number;
};

type NoteRow = {
  id: string;
  title: string;
  body: string;
  pinned: number;
  pin_start: number | null;
  pin_end: number | null;
  created_at: number;
  updated_at: number;
};

const DATABASE_VERSION = 4;

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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const fromRow = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  pinned: row.pinned !== 0,
  window: row.pin_start !== null && row.pin_end !== null ? { start: row.pin_start, end: row.pin_end } : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listNotes(db: SQLiteDatabase): Promise<Note[]> {
  const rows = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY created_at DESC');
  return rows.map(fromRow);
}

export async function insertNote(db: SQLiteDatabase, note: Note): Promise<void> {
  await db.runAsync(
    `INSERT INTO notes (id, title, body, pinned, pin_start, pin_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.title,
    note.body,
    note.pinned ? 1 : 0,
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
