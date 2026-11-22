import { describe, expect, it } from '@jest/globals';

import { openTestDatabase } from '../../test-utils/node-sqlite';
import { localCounts, restoreSnapshot, takeSnapshot } from '../backup-data';
import { makeSnapshot, readSnapshot } from '../backup-format';
import { DATABASE_VERSION, insertNote, listNotes, migrate, type Note } from '../db';
import { insertLink, listLinks, type Link } from '../links-db';
import { insertMemo, listMemos, type Memo } from '../memos-db';
import { insertTask, listTasks, type Task } from '../tasks-db';

const pinned: Note = {
  id: 'n1',
  title: 'Doctor',
  body: 'Bring the papers',
  pinned: true,
  window: { start: 1000, end: 2000 },
  favorite: true,
  createdAt: 1,
  updatedAt: 2,
};
const unpinned: Note = { ...pinned, id: 'n2', title: 'Later', pinned: false, window: null, favorite: false };
const link: Link = { id: 'l1', url: 'https://zort.ing/', title: 'Zort', favorite: false, createdAt: 3, updatedAt: 3 };
const memo: Memo = { id: 'm1', title: 'Shopping', body: 'Milk', favorite: true, createdAt: 4, updatedAt: 5 };
const task: Task = {
  id: 't1',
  title: 'Gym',
  body: '',
  due: new Date(2026, 0, 5, 18, 30).getTime(),
  repeat: {
    every: 1,
    unit: 'week',
    weekdays: [1, 3],
    start: new Date(2026, 0, 5).getTime(),
    end: { kind: 'count', count: 10 },
  },
  occurrence: 0,
  completedAt: null,
  reminder: 15,
  favorite: false,
  createdAt: 6,
  updatedAt: 6,
};

async function freshDatabase() {
  const db = openTestDatabase();
  await migrate(db);
  return db;
}

async function filledDatabase() {
  const db = await freshDatabase();
  await insertNote(db, pinned);
  await insertNote(db, unpinned);
  await insertLink(db, link);
  await insertMemo(db, memo);
  await insertTask(db, task);
  return db;
}

describe('Drive backup, through a real database', () => {
  it('brings everything back on an empty phone (the reinstall case)', async () => {
    const before = await filledDatabase();
    const text = JSON.stringify(await takeSnapshot(before));

    const after = await freshDatabase();
    await restoreSnapshot(after, readSnapshot(text, DATABASE_VERSION));

    expect(await listNotes(after)).toEqual(await listNotes(before));
    expect(await listLinks(after)).toEqual([link]);
    expect(await listMemos(after)).toEqual([memo]);
    expect(await listTasks(after)).toEqual([task]);
  });

  it('replaces what was on the phone', async () => {
    const backup = await takeSnapshot(await filledDatabase());
    const phone = await freshDatabase();
    await insertMemo(phone, { ...memo, id: 'other', title: 'Only on the phone' });

    await restoreSnapshot(phone, backup);

    expect(await listMemos(phone)).toEqual([memo]);
  });

  it('leaves a table the backup doesn’t have alone (a backup older than a tool)', async () => {
    const phone = await filledDatabase();
    const older = makeSnapshot({ notes: [], links: [] }, DATABASE_VERSION);

    await restoreSnapshot(phone, older);

    expect(await localCounts(phone)).toEqual({ notes: 0, links: 0, memos: 1, tasks: 1 });
  });

  it('gives a column the backup doesn’t have its default (a backup older than the column)', async () => {
    const phone = await freshDatabase();
    // A link from before favorites existed: no "favorite" field at all
    const older = makeSnapshot(
      { links: [{ id: 'l2', url: 'https://example.com/', title: '', created_at: 7, updated_at: 7 }] },
      DATABASE_VERSION,
    );

    await restoreSnapshot(phone, older);

    expect(await listLinks(phone)).toEqual([
      { id: 'l2', url: 'https://example.com/', title: '', favorite: false, createdAt: 7, updatedAt: 7 },
    ]);
  });

  it('ignores tables and columns this version doesn’t know', async () => {
    const phone = await freshDatabase();
    const fromElsewhere = makeSnapshot(
      { memos: [{ id: 'm9', title: 'Hi', body: '', favorite: 0, created_at: 1, updated_at: 1, color: 'red' }], gadgets: [{ id: 'g' }] },
      DATABASE_VERSION,
    );

    await restoreSnapshot(phone, fromElsewhere);

    expect(await listMemos(phone)).toEqual([
      { id: 'm9', title: 'Hi', body: '', favorite: false, createdAt: 1, updatedAt: 1 },
    ]);
  });

  it('changes nothing if the restore fails half way', async () => {
    const phone = await filledDatabase();
    // The second note has no title, which the table requires
    const broken = makeSnapshot(
      { links: [], notes: [{ id: 'ok', title: 'Fine', created_at: 1, updated_at: 1 }, { id: 'bad', created_at: 1, updated_at: 1 }] },
      DATABASE_VERSION,
    );

    await expect(restoreSnapshot(phone, broken)).rejects.toThrow();

    expect(await localCounts(phone)).toEqual({ notes: 2, links: 1, memos: 1, tasks: 1 });
  });
});
