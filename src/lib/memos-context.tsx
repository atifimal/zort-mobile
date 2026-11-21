import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { deleteMemo, insertMemo, listMemos, updateMemo, type Memo } from './memos-db';

export type MemoInput = { title: string; body: string };

type MemosContextValue = {
  memos: Memo[];
  loaded: boolean;
  createMemo(input: MemoInput): Promise<Memo>;
  editMemo(id: string, input: MemoInput): Promise<void>;
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
        createdAt: now,
        updatedAt: now,
      };
      await insertMemo(db, memo);
      commit([memo, ...memosRef.current]);
      return memo;
    },
    [db, commit],
  );

  const editMemo = useCallback(
    async (id: string, input: MemoInput) => {
      const existing = memosRef.current.find((memo) => memo.id === id);
      if (!existing) throw new Error(`Note ${id} not found`);
      const memo: Memo = { ...existing, title: input.title.trim(), body: input.body.trim(), updatedAt: Date.now() };
      await updateMemo(db, memo);
      // The list is ordered by last edit, so the edited note moves to the top
      commit([memo, ...memosRef.current.filter((item) => item.id !== id)]);
    },
    [db, commit],
  );

  const removeMemo = useCallback(
    async (id: string) => {
      await deleteMemo(db, id);
      commit(memosRef.current.filter((memo) => memo.id !== id));
    },
    [db, commit],
  );

  const value = useMemo(
    () => ({ memos, loaded, createMemo, editMemo, removeMemo }),
    [memos, loaded, createMemo, editMemo, removeMemo],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}

export function useMemos(): MemosContextValue {
  const value = useContext(MemosContext);
  if (!value) throw new Error('useMemos must be used inside MemosProvider');
  return value;
}
