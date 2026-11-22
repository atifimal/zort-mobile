import { describe, expect, it } from '@jest/globals';

import {
  backupFileName,
  BackupInvalidError,
  BackupTooNewError,
  canReplace,
  makeSnapshot,
  readSnapshot,
  restoreColumns,
  UPGRADES,
} from '../backup-format';

const note = { id: 'n1', title: 'Doctor', body: '', pinned: 1, favorite: 0, created_at: 1, updated_at: 1 };

describe('readSnapshot', () => {
  it('reads back what makeSnapshot wrote', () => {
    const snapshot = makeSnapshot({ notes: [note], links: [], memos: [] }, 5, 123);
    expect(readSnapshot(JSON.stringify(snapshot), 5)).toEqual(snapshot);
  });

  it('reads the first builds’ format (tables at the top level)', () => {
    const v1 = { format: 'zort-backup', version: 1, exportedAt: 9, notes: [note], links: [], memos: [] };
    const snapshot = readSnapshot(JSON.stringify(v1), 5);
    expect(snapshot.schema).toBe(5);
    expect(snapshot.tables.notes).toEqual([note]);
  });

  it('reads an older backup in a newer app, without the tables it didn’t have yet', () => {
    // As if a sixth tool came with schema 6: a schema 5 backup has no "todos"
    const snapshot = readSnapshot(JSON.stringify(makeSnapshot({ notes: [note] }, 5)), 6);
    expect(snapshot.schema).toBe(6);
    expect(snapshot.tables.notes).toEqual([note]);
    expect(snapshot.tables.todos).toBeUndefined();
  });

  it('refuses a backup from a newer app', () => {
    const newer = JSON.stringify(makeSnapshot({ notes: [note], todos: [] }, 6));
    expect(() => readSnapshot(newer, 5)).toThrow(BackupTooNewError);
  });

  it('refuses a newer file format', () => {
    const newer = JSON.stringify({ format: 'zort-backup', version: 3, schema: 9, tables: {} });
    expect(() => readSnapshot(newer, 5)).toThrow(BackupTooNewError);
  });

  it.each([
    ['not JSON', '{'],
    ['another file', JSON.stringify({ hello: 'world' })],
    ['rows that aren’t rows', JSON.stringify({ ...makeSnapshot({}, 5), tables: { notes: [1, 2] } })],
  ])('refuses %s', (_name, text) => {
    expect(() => readSnapshot(text, 5)).toThrow(BackupInvalidError);
  });

  it('runs the upgrades between the backup’s schema and the app’s, in order', () => {
    UPGRADES[6] = (tables) => ({ ...tables, notes: tables.notes?.map(({ body, ...row }) => ({ ...row, text: body })) });
    UPGRADES[7] = (tables) => ({ ...tables, notes: tables.notes?.map((row) => ({ ...row, text: `${row.text}!` })) });
    try {
      const snapshot = readSnapshot(JSON.stringify(makeSnapshot({ notes: [{ id: 'a', body: 'hi' }] }, 5)), 7);
      expect(snapshot.tables.notes).toEqual([{ id: 'a', text: 'hi!' }]);
      // Already at schema 6: only the 7th runs
      const six = readSnapshot(JSON.stringify(makeSnapshot({ notes: [{ id: 'b', text: 'yo' }] }, 6)), 7);
      expect(six.tables.notes).toEqual([{ id: 'b', text: 'yo!' }]);
    } finally {
      delete UPGRADES[6];
      delete UPGRADES[7];
    }
  });
});

describe('canReplace', () => {
  it('lets an app replace a backup from its own or an older version, never a newer one', () => {
    expect(canReplace(null, 5)).toBe(true);
    expect(canReplace(4, 5)).toBe(true);
    expect(canReplace(5, 5)).toBe(true);
    expect(canReplace(6, 5)).toBe(false);
  });
});

describe('restoreColumns', () => {
  it('keeps the table’s columns the row has: missing ones get their default, unknown ones are dropped', () => {
    expect(restoreColumns({ id: 'x', title: 't', gone: 1 }, ['id', 'title', 'favorite'])).toEqual(['id', 'title']);
  });
});

describe('backup file name', () => {
  it('is dated in local time, to the minute', () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 7).getTime(), 'zort-yedek')).toBe('zort-yedek-2026-01-05-0907.json');
  });
});
