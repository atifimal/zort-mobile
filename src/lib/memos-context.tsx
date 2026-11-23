import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDataChanges } from './data-events';
import { setFavorite as setRowFavorite } from './db';
import type { LabelColor } from './label-colors';
import {
  deleteMemo,
  deleteMemoLabel,
  insertMemo,
  insertMemoLabel,
  listMemoLabels,
  listMemos,
  updateMemo,
  updateMemoLabel,
  type Memo,
  type MemoLabel,
} from './memos-db';

/** `labelId` left out: none (a new note), or unchanged (an edit). */
export type MemoInput = { title: string; body: string; labelId?: string | null };
export type LabelInput = { name: string; color: LabelColor };

type MemosContextValue = {
  memos: Memo[];
  labels: MemoLabel[];
  loaded: boolean;
  createMemo(input: MemoInput): Promise<Memo>;
  editMemo(id: string, input: MemoInput): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  removeMemo(id: string): Promise<void>;
  createLabel(input: LabelInput): Promise<MemoLabel>;
  editLabel(id: string, input: LabelInput): Promise<void>;
  removeLabel(id: string): Promise<void>;
};

const MemosContext = createContext<MemosContextValue | null>(null);

/** The Notes page's notes and their labels; at the root so the home screen can count them. */
export function MemosProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [labels, setLabels] = useState<MemoLabel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const memosRef = useRef(memos);
  const labelsRef = useRef(labels);

  const commit = useCallback((next: Memo[]) => {
    memosRef.current = next;
    setMemos(next);
  }, []);

  const commitLabels = useCallback((next: MemoLabel[]) => {
    labelsRef.current = next;
    setLabels(next);
  }, []);

  const load = useCallback(async () => {
    const [nextMemos, nextLabels] = await Promise.all([listMemos(db), listMemoLabels(db)]);
    return { nextMemos, nextLabels };
  }, [db]);

  // Another copy of this provider (the widget's quick-add window, or the app) changed the notes
  const announce = useDataChanges('memos', () => {
    load()
      .then(({ nextMemos, nextLabels }) => {
        commit(nextMemos);
        commitLabels(nextLabels);
      })
      .catch((error) => console.error('Could not reload memos', error));
  });

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ nextMemos, nextLabels }) => {
        if (cancelled) return;
        commit(nextMemos);
        commitLabels(nextLabels);
      })
      .catch((error) => console.error('Could not load notes', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load, commit, commitLabels]);

  const createMemo = useCallback(
    async (input: MemoInput) => {
      const now = Date.now();
      const memo: Memo = {
        id: randomUUID(),
        title: input.title.trim(),
        body: input.body.trim(),
        labelId: input.labelId ?? null,
        favorite: false,
        createdAt: now,
        updatedAt: now,
      };
      await insertMemo(db, memo);
      commit([memo, ...memosRef.current]);
      announce();
      return memo;
    },
    [db, commit, announce],
  );

  const editMemo = useCallback(
    async (id: string, input: MemoInput) => {
      const existing = memosRef.current.find((memo) => memo.id === id);
      if (!existing) throw new Error(`Note ${id} not found`);
      const memo: Memo = {
        ...existing,
        title: input.title.trim(),
        body: input.body.trim(),
        labelId: input.labelId === undefined ? existing.labelId : input.labelId,
        updatedAt: Date.now(),
      };
      await updateMemo(db, memo);
      // The list is ordered by last edit, so the edited note moves to the top
      commit([memo, ...memosRef.current.filter((item) => item.id !== id)]);
      announce();
    },
    [db, commit, announce],
  );

  // Not an edit: the note keeps its place among the others (updatedAt is unchanged)
  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await setRowFavorite(db, 'memos', id, favorite);
      commit(memosRef.current.map((memo) => (memo.id === id ? { ...memo, favorite } : memo)));
      announce();
    },
    [db, commit, announce],
  );

  const removeMemo = useCallback(
    async (id: string) => {
      await deleteMemo(db, id);
      commit(memosRef.current.filter((memo) => memo.id !== id));
      announce();
    },
    [db, commit, announce],
  );

  const createLabel = useCallback(
    async (input: LabelInput) => {
      const label: MemoLabel = { id: randomUUID(), name: input.name.trim(), color: input.color, createdAt: Date.now() };
      await insertMemoLabel(db, label);
      commitLabels([...labelsRef.current, label]);
      announce();
      return label;
    },
    [db, commitLabels, announce],
  );

  const editLabel = useCallback(
    async (id: string, input: LabelInput) => {
      const existing = labelsRef.current.find((label) => label.id === id);
      if (!existing) throw new Error(`Label ${id} not found`);
      const label: MemoLabel = { ...existing, name: input.name.trim(), color: input.color };
      await updateMemoLabel(db, label);
      commitLabels(labelsRef.current.map((item) => (item.id === id ? label : item)));
      announce();
    },
    [db, commitLabels, announce],
  );

  const removeLabel = useCallback(
    async (id: string) => {
      await deleteMemoLabel(db, id);
      commitLabels(labelsRef.current.filter((label) => label.id !== id));
      commit(memosRef.current.map((memo) => (memo.labelId === id ? { ...memo, labelId: null } : memo)));
      announce();
    },
    [db, commit, commitLabels, announce],
  );

  const value = useMemo(
    () => ({ memos, labels, loaded, createMemo, editMemo, setFavorite, removeMemo, createLabel, editLabel, removeLabel }),
    [memos, labels, loaded, createMemo, editMemo, setFavorite, removeMemo, createLabel, editLabel, removeLabel],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosContextValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos must be used inside MemosProvider');
  return value;
}
