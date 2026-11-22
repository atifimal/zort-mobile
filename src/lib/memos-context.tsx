import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDataChanges } from './data-events';
import { setFavorite as setRowFavorite } from './db';
import { deleteMemo, insertMemo, listMemos, updateMemo, type Memo } from './memos-db';

export type MemoInput = { title: string; body: string };

type MemosContextValue = {
  memos: Memo[];
  loaded: boolean;
  createMemo(input: MemoInput): Promise<Memo>;
  editMemo(id: string, input: MemoInput): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  removeMemo(id: string): Promise<void>;
};

const MemosContext = createContext<MemosContextValue | null>(null);

/** The Notes page's notes; at the root so the home screen can show how many there are. */
export function MemosProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const memosRef = useRef(memos);

  const commit = useCallback((next: Memo[]) => {
    memosRef.current = next;
    setMemos(next);
  }, []);

  // Another copy of this provider (the widget's quick-add window, or the app) changed the notes
  const announce = useDataChanges('memos', () => {
    listMemos(db)
      .then(commit)
      .catch((error) => console.error('Could not reload memos', error));
  });

  useEffect(() => {
    let cancelled = false;
    listMemos(db)
      .then((rows) => {
        if (!cancelled) commit(rows);
      })
      .catch((error) => console.error('Could not load notes', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, commit]);

  const createMemo = useCallback(
    async (input: MemoInput) => {
      const now = Date.now();
      const memo: Memo = {
        id: randomUUID(),
        title: input.title.trim(),
        body: input.body.trim(),
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
      const memo: Memo = { ...existing, title: input.title.trim(), body: input.body.trim(), updatedAt: Date.now() };
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

  const value = useMemo(
    () => ({ memos, loaded, createMemo, editMemo, setFavorite, removeMemo }),
    [memos, loaded, createMemo, editMemo, setFavorite, removeMemo],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosContextValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos must be used inside MemosProvider');
  return value;
}
