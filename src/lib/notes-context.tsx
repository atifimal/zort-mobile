import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  acknowledgeNoteActions,
  addNoteActionListener,
  getPendingNoteActions,
  getPermissionStatus,
  requestPermission as requestNativePermission,
  syncPinnedNotes,
  type PermissionStatus,
} from '@modules/pinned-notifications';

import {
  deleteNote,
  insertNote,
  listNotes,
  setFavorite as setRowFavorite,
  setNotePinned,
  updateNote,
  type Note,
  type PinWindow,
} from './db';
import { useDataChanges } from './data-events';
import { nextStatusChange } from './pin-status';

export type NoteInput = { title: string; body: string; pinned: boolean; window: PinWindow | null };

type NotesContextValue = {
  notes: Note[];
  loaded: boolean;
  permission: PermissionStatus | null;
  /** The current time, updated whenever a note's window starts or ends. */
  now: number;
  createNote(input: NoteInput): Promise<Note>;
  editNote(id: string, input: NoteInput): Promise<void>;
  setPinned(id: string, pinned: boolean): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  removeNote(id: string): Promise<void>;
  requestPermission(): Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

const normalize = (input: NoteInput): NoteInput => ({
  title: input.title.trim(),
  body: input.body.trim(),
  pinned: input.pinned,
  window: input.window,
});

// setTimeout fires at once beyond ~24.8 days; later changes are picked up by a later tick
const MAX_TIMER = 24 * 60 * 60_000;

/**
 * The notes, plus keeping the notifications in step with them: after every change, whenever
 * the app comes back to the foreground, and when notification permission is granted. Unpin
 * and Delete tapped on a notification are applied here too, as soon as the app is told.
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [now, setNow] = useState(Date.now);

  const notesRef = useRef(notes);
  const askedThisLaunch = useRef(false);

  // Every change to the list goes through here, so a sync started right after uses it
  const commit = useCallback((next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
  }, []);

  // Another copy of this provider (the widget's quick-add window, or the app) wrote to the
  // notes: read them again, so this copy never syncs notifications from an old list
  const reloadRef = useRef<() => void>(() => {});
  const announce = useDataChanges('notes', () => reloadRef.current());

  // Native syncs run one after another so an older list can never overwrite a newer one
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  const syncNotifications = useCallback(() => {
    syncChain.current = syncChain.current
      .then(() =>
        syncPinnedNotes(
          notesRef.current
            .filter((note) => note.pinned)
            .map((note) => ({
              id: note.id,
              title: note.title,
              body: note.body,
              url: `zort://pin-notes/${note.id}`,
              sortKey: note.createdAt,
              startsAt: note.window?.start ?? null,
              endsAt: note.window?.end ?? null,
            })),
        ),
      )
      .catch((error) => console.warn('Could not update notifications', error));
    return syncChain.current;
  }, []);

  /**
   * Applies Unpin / Delete taps from notifications to the database, then confirms them so the
   * native side stops holding those notes back. With `reload`, reads the list even if there
   * was nothing to apply (the first load).
   */
  const applyNotificationActions = useCallback(
    async ({ reload = false } = {}) => {
      const actions = await getPendingNoteActions().catch(() => []);
      if (actions.length === 0 && !reload) return;
      const updatedAt = Date.now();
      for (const { id, action } of actions) {
        if (action === 'delete') await deleteNote(db, id);
        else await setNotePinned(db, id, false, updatedAt);
      }
      commit(await listNotes(db));
      if (actions.length > 0) {
        announce();
        await acknowledgeNoteActions(actions.map((item) => item.id)).catch(() => {});
      }
    },
    [db, commit, announce],
  );

  useEffect(() => {
    reloadRef.current = () => {
      applyNotificationActions({ reload: true }).catch((error) => console.error('Could not reload notes', error));
    };
  }, [applyNotificationActions]);

  const refreshPermission = useCallback(async () => {
    const status = await getPermissionStatus().catch(() => null);
    setPermission(status);
    return status;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Loads from the database: its state updates happen after awaits, not during the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyNotificationActions({ reload: true })
      .catch((error) => console.error('Could not load notes', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    refreshPermission();
    return () => {
      cancelled = true;
    };
  }, [applyNotificationActions, refreshPermission]);

  // Unpin / Delete tapped in the shade while the app is running
  useEffect(() => {
    const subscription = addNoteActionListener(() => {
      applyNotificationActions().catch((error) => console.error('Could not apply notification action', error));
    });
    return () => subscription.remove();
  }, [applyNotificationActions]);

  // Every change to the list including the first load, and once permission is granted
  const canNotify = permission === 'granted';
  useEffect(() => {
    if (loaded) syncNotifications();
  }, [loaded, notes, canNotify, syncNotifications]);

  // Re-render when a window starts or ends (the notifications themselves are handled natively)
  useEffect(() => {
    const next = nextStatusChange(notes, now);
    if (next === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - Date.now() + 100, MAX_TIMER));
    return () => clearTimeout(timer);
  }, [notes, now]);

  // Back in the foreground: permission may have changed in Settings, notifications may have
  // been cleared while the app couldn't react (force stop on Android, "Clear" on iOS), a
  // notification's buttons may have been used, and timers don't run in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(Date.now());
      refreshPermission();
      if (!loaded) return;
      applyNotificationActions()
        .catch((error) => console.error('Could not apply notification actions', error))
        .finally(syncNotifications);
    });
    return () => subscription.remove();
  }, [loaded, refreshPermission, applyNotificationActions, syncNotifications]);

  const requestPermission = useCallback(async () => {
    const status = await requestNativePermission().catch(() => null);
    setPermission(status);
  }, []);

  const createNote = useCallback(
    async (input: NoteInput) => {
      const time = Date.now();
      const note: Note = { id: randomUUID(), ...normalize(input), favorite: false, createdAt: time, updatedAt: time };
      await insertNote(db, note);
      commit([note, ...notesRef.current]);
      announce();
      setNow(time);

      // Ask at the moment it matters, once per launch, and only with the system dialog:
      // if that's no longer allowed, the banner on the list offers the way to Settings.
      if (note.pinned && !askedThisLaunch.current && (await refreshPermission()) !== 'granted') {
        askedThisLaunch.current = true;
        const status = await requestNativePermission({ openSettings: false }).catch(() => null);
        setPermission(status);
      }
      return note;
    },
    [db, commit, announce, refreshPermission],
  );

  const editNote = useCallback(
    async (id: string, input: NoteInput) => {
      const existing = notesRef.current.find((note) => note.id === id);
      if (!existing) throw new Error(`Note ${id} not found`);
      const note: Note = { ...existing, ...normalize(input), updatedAt: Date.now() };
      await updateNote(db, note);
      commit(notesRef.current.map((item) => (item.id === id ? note : item)));
      announce();
      setNow(note.updatedAt);
    },
    [db, commit, announce],
  );

  const setPinned = useCallback(
    async (id: string, pinned: boolean) => {
      const updatedAt = Date.now();
      await setNotePinned(db, id, pinned, updatedAt);
      commit(notesRef.current.map((note) => (note.id === id ? { ...note, pinned, updatedAt } : note)));
      announce();
      setNow(updatedAt);
    },
    [db, commit, announce],
  );

  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await setRowFavorite(db, 'notes', id, favorite);
      commit(notesRef.current.map((note) => (note.id === id ? { ...note, favorite } : note)));
      announce();
    },
    [db, commit, announce],
  );

  const removeNote = useCallback(
    async (id: string) => {
      await deleteNote(db, id);
      commit(notesRef.current.filter((note) => note.id !== id));
      announce();
    },
    [db, commit, announce],
  );

  const value = useMemo(
    () => ({
      notes,
      loaded,
      permission,
      now,
      createNote,
      editNote,
      setPinned,
      setFavorite,
      removeNote,
      requestPermission,
    }),
    [notes, loaded, permission, now, createNote, editNote, setPinned, setFavorite, removeNote, requestPermission],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const value = useContext(NotesContext);
  if (!value) throw new Error('useNotes must be used inside NotesProvider');
  return value;
}
