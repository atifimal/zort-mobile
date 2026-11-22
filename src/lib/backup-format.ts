/**
 * The Drive backup file: what's in it, and how an old one is read by a newer app. Pure logic
 * (no database, no network), so it can be tested on its own (backup-format.test.ts).
 *
 * Adding a tool (a new menu with its own table)
 *   1. Create the table in a new database migration (db.ts) and raise DATABASE_VERSION.
 *   2. Add the table's name to BACKUP_TABLES below.
 *   Older backups simply don't have the table: restoring one leaves that table as it is.
 *
 * Changing a table
 *   - Adding a column (with a DEFAULT): nothing to do here. Restoring an older backup leaves it
 *     to the default; every column is backed up as it is, there is no list of them.
 *   - Renaming or reshaping data: add an entry to UPGRADES for the new DATABASE_VERSION that
 *     turns an older backup's rows into the new shape, like the migration does for the database.
 */

/** The tables that are backed up; a new tool adds its own. */
export const BACKUP_TABLES = ['notes', 'links', 'memos'] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type Row = Record<string, unknown>;
export type Tables = Partial<Record<string, Row[]>>;

/** The file's own layout; only changes if the wrapper below does, not with the database. */
const FORMAT = 2;

export type Snapshot = {
  format: 'zort-backup';
  version: typeof FORMAT;
  /** The DATABASE_VERSION of the app that made it: the shape of the rows. */
  schema: number;
  exportedAt: number;
  tables: Tables;
};

/**
 * Turns an older backup's rows into the next schema's shape: UPGRADES[n] takes a backup made
 * at schema n - 1 to schema n. Only for changes a new column's DEFAULT can't cover. Example:
 *   6: (tables) => ({ ...tables, notes: tables.notes?.map(({ body, ...row }) => ({ ...row, text: body })) }),
 */
export const UPGRADES: Record<number, (tables: Tables) => Tables> = {};

/** A backup written by a newer version of Zort: restoring it, or replacing it, would lose data. */
export class BackupTooNewError extends Error {
  constructor(readonly schema: number) {
    super(`The backup was made by a newer version of Zort (database ${schema})`);
    this.name = 'BackupTooNewError';
  }
}

export class BackupInvalidError extends Error {
  constructor(reason: string) {
    super(`Not a Zort backup: ${reason}`);
    this.name = 'BackupInvalidError';
  }
}

export function makeSnapshot(tables: Tables, schema: number, now = Date.now()): Snapshot {
  return { format: 'zort-backup', version: FORMAT, schema, exportedAt: now, tables };
}

/**
 * Reads a downloaded backup and brings it up to `schema` (the app's DATABASE_VERSION). Throws
 * BackupTooNewError for one from a newer app, BackupInvalidError for anything else it can't use.
 */
export function readSnapshot(text: string, schema: number): Snapshot {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupInvalidError('not JSON');
  }
  if (!isObject(data) || data.format !== 'zort-backup') throw new BackupInvalidError('unknown format');

  // Format 1 (the first builds): the three tables at the top level, schema 5
  const { tables, made } =
    data.version === 1
      ? { tables: { notes: data.notes, links: data.links, memos: data.memos } as Tables, made: 5 }
      : data.version === FORMAT
        ? { tables: data.tables as Tables, made: data.schema }
        : { tables: undefined, made: undefined };
  if (typeof data.version === 'number' && data.version > FORMAT) throw new BackupTooNewError(Number(data.schema) || 0);
  if (!isObject(tables) || typeof made !== 'number') throw new BackupInvalidError('unknown version');
  if (made > schema) throw new BackupTooNewError(made);

  for (const [table, rows] of Object.entries(tables)) {
    if (rows !== undefined && !(Array.isArray(rows) && rows.every(isObject))) {
      throw new BackupInvalidError(`${table} is not a list of rows`);
    }
  }

  let upgraded = tables;
  for (let next = made + 1; next <= schema; next++) {
    const upgrade = UPGRADES[next];
    if (upgrade) upgraded = upgrade(upgraded);
  }
  return makeSnapshot(upgraded, schema, typeof data.exportedAt === 'number' ? data.exportedAt : 0);
}

/** Whether a backup made at `remoteSchema` may be replaced by this app (`schema`). */
export function canReplace(remoteSchema: number | null, schema: number): boolean {
  return remoteSchema === null || remoteSchema <= schema;
}

/**
 * The columns a row restores into: the table's own columns that the row has. A column the row
 * lacks (added after the backup was made) is left to its DEFAULT; one the table no longer has
 * is dropped.
 */
export function restoreColumns(row: Row, tableColumns: readonly string[]): string[] {
  return tableColumns.filter((column) => Object.prototype.hasOwnProperty.call(row, column));
}

/** Only what SQLite stores; anything else becomes NULL. */
export function toSqlValue(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

export type Counts = { notes: number; links: number; memos: number };

export const countsOf = (tables: Tables): Counts => ({
  notes: tables.notes?.length ?? 0,
  links: tables.links?.length ?? 0,
  memos: tables.memos?.length ?? 0,
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
