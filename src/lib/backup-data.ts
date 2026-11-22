import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_TABLES,
  makeSnapshot,
  restoreColumns,
  toSqlValue,
  type Counts,
  type Row,
  type Snapshot,
  type Tables,
} from './backup-format';
import { DATABASE_VERSION } from './db';

export type { Counts, Snapshot } from './backup-format';

/**
 * The database side of the Drive backup: every row of the backed-up tables, as stored, and back.
 * The file format and its rules for older backups are in backup-format.ts.
 */
export async function takeSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const tables: Tables = {};
  for (const table of BACKUP_TABLES) tables[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  return makeSnapshot(tables, DATABASE_VERSION);
}

export async function localCounts(db: SQLiteDatabase): Promise<Counts> {
  const count = async (table: string) =>
    (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
  return { notes: await count('notes'), links: await count('links'), memos: await count('memos') };
}

export const isEmpty = (counts: Counts) => counts.notes + counts.links + counts.memos === 0;

/**
 * Replaces each backed-up table with the backup's rows, all in one transaction. A table the
 * backup doesn't have (it's older than the tool) is left as it is.
 */
export async function restoreSnapshot(db: SQLiteDatabase, snapshot: Snapshot): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of BACKUP_TABLES) {
      const rows = snapshot.tables[table];
      if (!rows) continue;
      const columns = (await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
      await tx.runAsync(`DELETE FROM ${table}`);
      for (const row of rows) {
        const present = restoreColumns(row, columns);
        if (present.length === 0) continue;
        await tx.runAsync(
          `INSERT INTO ${table} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})`,
          present.map((column) => toSqlValue(row[column])),
        );
      }
    }
  });
}
