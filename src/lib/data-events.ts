import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tells the other copies of a provider that a table changed. The app and the widget's quick-add
 * window run in the same JavaScript runtime but as separate React trees, each with its own
 * providers; without this, the app would keep showing (and syncing notifications from) a list
 * that no longer matches the database.
 */
export type DataTable = 'notes' | 'links' | 'memos' | 'tasks';

type Listener = (table: DataTable, source: symbol) => void;
const listeners = new Set<Listener>();

/**
 * For one provider instance: the returned function announces this instance's writes; `reload`
 * runs when another instance writes to `table`.
 */
export function useDataChanges(table: DataTable, reload: () => void) {
  const [source] = useState(() => Symbol(table));
  const reloadRef = useRef(reload);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    const listener: Listener = (changedTable, from) => {
      if (changedTable === table && from !== source) reloadRef.current();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [table, source]);

  return useCallback(() => emit(table, source), [table, source]);
}

function emit(table: DataTable, source: symbol) {
  for (const listener of [...listeners]) listener(table, source);
}

const OUTSIDE = Symbol('outside');

/** A write made outside the providers (restoring a backup): every copy of them reloads. */
export function announceChange(table: DataTable) {
  emit(table, OUTSIDE);
}

/**
 * Every write, whoever made it (the Drive backup listens here). `outside` is true for
 * announceChange, i.e. for writes that didn't come from the user.
 */
export function subscribeToChanges(listener: (table: DataTable, outside: boolean) => void): () => void {
  const wrapped: Listener = (table, source) => listener(table, source === OUTSIDE);
  listeners.add(wrapped);
  return () => {
    listeners.delete(wrapped);
  };
}
