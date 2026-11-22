/// <reference types="node" />
// For tests: the part of expo-sqlite's SQLiteDatabase the app uses, on Node's own SQLite, so the
// real migrations and the real backup SQL run against a real database (in memory).
import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

type Params = (string | number | null)[];

// expo-sqlite takes the values either spread out or as one array
const flatten = (params: unknown[]): Params =>
  (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Params;

export function openTestDatabase(): SQLiteDatabase {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const result = sqlite.prepare(sql).run(...flatten(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...flatten(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...flatten(params)),
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        await task(db);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as SQLiteDatabase;
}
