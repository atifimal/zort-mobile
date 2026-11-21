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
  getPermissionStatus,
  requestPermission as requestNativePermission,
  syncPinnedNotes,
  type PermissionStatus,
} from '@modules/pinned-notifications';

import { deleteNote, insertNote, listNotes, updateNote, type Note } from './db';

export type NoteInput = { title: string; body: string };

type NotesContextValue = {
  notes: Note[];
  loaded: boolean;
  permission: PermissionStatus | null;
  createNote(input: NoteInput): Promise<Note>;
  editNote(id: string, input: NoteInput): Promise<void>;
  removeNote(id: string): Promise<void>;
  requestPermission(): Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

const normalize = (input: NoteInput): NoteInput => ({
  title: input.title.trim(),
  body: input.body.trim(),
});

/**
 * The notes, plus keeping the notifications in step with them: after every change, whenever
 * the app comes back to the foreground, and when notification permission is granted.
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus | null>(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const askedThisLaunch = useRef(false);

  // Native syncs run one after another so an older list can never overwrite a newer one
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  const syncNotifications = useCallback(() => {
    syncChain.current = syncChain.current
      .then(() =>
        syncPinnedNotes(
          notesRef.current.map((note) => ({
            id: note.id,
            title: note.title,
            body: note.body,
            url: `zort://pin-notes/${note.id}`,
            sortKey: note.createdAt,
          })),
        ),
      )
      .catch((error) => console.warn('Could not update notifications', error));
    return syncChain.current;
  }, []);

  const refreshPermission = useCallback(async () => {
    const status = await getPermissionStatus().catch(() => null);
    setPermission(status);
    return status;
  }, []);

  useEffect(() => {
    let cancelled = false;
    listNotes(db)
      .then((rows) => {
        if (!cancelled) setNotes(rows);
      })
      .catch((error) => console.error('Could not load notes', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    refreshPermission();
    return () => {
      cancelled = true;
    };
  }, [db, refreshPermission]);

  // Every change to the list including the first load, and once permission is granted
  const canNotify = permission === 'granted';
  useEffect(() => {
    if (loaded) syncNotifications();
  }, [loaded, notes, canNotify, syncNotifications]);

  // Back in the foreground: permission may have changed in Settings, and notifications may have
  // been cleared while the app couldn't react (force stop on Android, "Clear" on iOS).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshPermission();
      if (loaded) syncNotifications();
    });
    return () => subscription.remove();
  }, [loaded, refreshPermission, syncNotifications]);

  const requestPermission = useCallback(async () => {
    const status = await requestNativePermission().catch(() => null);
    setPermission(status);
  }, []);

  const createNote = useCallback(
    async (input: NoteInput) => {
      const now = Date.now();
      const note: Note = { id: randomUUID(), ...normalize(input), createdAt: now, updatedAt: now };
      await insertNote(db, note);
      setNotes((current) => [note, ...current]);

      // Ask at the moment it matters, once per launch, and only with the system dialog:
      // if that's no longer allowed, the banner on the list offers the way to Settings.
      if (!askedThisLaunch.current && (await refreshPermission()) !== 'granted') {
        askedThisLaunch.current = true;
        const status = await requestNativePermission({ openSettings: false }).catch(() => null);
        setPermission(status);
      }
      return note;
    },
    [db, refreshPermission],
  );

  const editNote = useCallback(
    async (id: string, input: NoteInput) => {
      const existing = notesRef.current.find((note) => note.id === id);
      if (!existing) throw new Error(`Note ${id} not found`);
      const note: Note = { ...existing, ...normalize(input), updatedAt: Date.now() };
      await updateNote(db, note);
      setNotes((current) => current.map((item) => (item.id === id ? note : item)));
    },
    [db],
  );

  const removeNote = useCallback(
    async (id: string) => {
      await deleteNote(db, id);
      setNotes((current) => current.filter((note) => note.id !== id));
    },
    [db],
  );

  const value = useMemo(
    () => ({ notes, loaded, permission, createNote, editNote, removeNote, requestPermission }),
    [notes, loaded, permission, createNote, editNote, removeNote, requestPermission],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const value = useContext(NotesContext);
  if (!value) throw new Error('useNotes must be used inside NotesProvider');
  return value;
}
