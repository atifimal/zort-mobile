import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { isEmpty, localCounts, restoreSnapshot, takeSnapshot, type Counts, type Snapshot } from './backup-data';
import { BACKUP_TABLES, BackupInvalidError, BackupTooNewError, canReplace, countsOf, readSnapshot } from './backup-format';
import { DATABASE_VERSION } from './db';
import { announceChange, subscribeToChanges } from './data-events';
import { deleteBackup, downloadBackup, findBackup, uploadBackup, type RemoteBackup } from './drive';
import { restoreSession, signIn, signInErrorMessage, signOut, type Account } from './google-auth';
import { t } from './i18n';

/**
 * Google Drive backup. One for the whole app: the app and the widget's quick-add window share
 * it (they share the JavaScript runtime), so whatever either of them writes gets backed up.
 *
 * Every change marks the data as not backed up yet ("pending", kept on the device so it
 * survives the app being closed) and uploads it a few seconds later, or straight away when the
 * app goes to the background, where timers stop. The whole data set is one file in the app's
 * hidden Drive folder, replaced each time.
 */
export type BackupState = {
  /** Whether the saved sign-in has been checked. */
  ready: boolean;
  account: Account | null;
  /** Uploading right now. */
  syncing: boolean;
  /** Changes that aren't in Drive yet. */
  pending: boolean;
  lastBackupAt: number | null;
  /** Why the last upload failed; cleared by the next one that works. */
  error: string | null;
  /** When the data was last exported to a file (Backup screen, "Save to a file"). */
  lastFileExportAt: number | null;
};

const KEYS = {
  fileId: 'backup.fileId',
  lastAt: 'backup.lastAt',
  pending: 'backup.pending',
  fileExportAt: 'backup.fileExportAt',
} as const;
const DEBOUNCE_MS = 3000;

function read(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) Storage.removeItemSync(key);
    else Storage.setItemSync(key, value);
  } catch {
    // Only bookkeeping: at worst the next backup happens a little later
  }
}

let state: BackupState = {
  ready: false,
  account: null,
  syncing: false,
  pending: read(KEYS.pending) === '1',
  lastBackupAt: Number(read(KEYS.lastAt)) || null,
  error: null,
  lastFileExportAt: Number(read(KEYS.fileExportAt)) || null,
};
const subscribers = new Set<() => void>();
function update(patch: Partial<BackupState>) {
  state = { ...state, ...patch };
  for (const subscriber of subscribers) subscriber();
}

let db: SQLiteDatabase | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let runAgain = false;

function markPending() {
  write(KEYS.pending, '1');
  update({ pending: true });
  schedule();
}

function schedule(delay = DEBOUNCE_MS) {
  clearTimeout(timer);
  if (state.account) timer = setTimeout(() => void backUp(), delay);
}

// The user's own writes; a restore's (`outside`) are already what Drive has
subscribeToChanges((_table, outside) => {
  if (!outside) markPending();
});

AppState.addEventListener('change', (appState) => {
  if (!state.pending || !state.account) return;
  if (appState === 'background') {
    clearTimeout(timer);
    void backUp();
  } else if (appState === 'active') {
    schedule(1000);
  }
});

/** What to tell the user about a failed backup, restore or sign-in; null if they cancelled. */
export function backupErrorMessage(error: unknown): string | null {
  // fetch() fails with a TypeError when there's no connection
  if (error instanceof TypeError) return t('backupOffline');
  if (error instanceof BackupTooNewError) return t('backupNeedsUpdate');
  if (error instanceof BackupInvalidError) return t('backupInvalid');
  return signInErrorMessage(error);
}

const errorMessage = (error: unknown) => backupErrorMessage(error) ?? t('backupFailed');

/** The backup in Drive, read and brought up to this app's schema. */
async function download(remote: RemoteBackup): Promise<Snapshot> {
  if (!canReplace(remote.schema, DATABASE_VERSION)) throw new BackupTooNewError(remote.schema ?? 0);
  return readSnapshot(await downloadBackup(remote.id), DATABASE_VERSION);
}

/** Uploads the data now; one upload at a time, and one more if something changed meanwhile. */
export function backUp(): Promise<void> {
  if (!db || !state.account) return Promise.resolve();
  if (running) {
    runAgain = true;
    return running;
  }
  const database = db;
  running = (async () => {
    update({ syncing: true });
    // Cleared before reading the data: a change made during the upload sets it again
    write(KEYS.pending, '0');
    try {
      // A newer Zort (another phone, already updated) wrote it: replacing it would drop what this
      // version doesn't know about, so this one stops until it's updated
      const current = await findBackup();
      if (current && !canReplace(current.schema, DATABASE_VERSION)) throw new BackupTooNewError(current.schema ?? 0);
      const snapshot = await takeSnapshot(database);
      const remote = await uploadBackup(JSON.stringify(snapshot), DATABASE_VERSION, current?.id ?? null);
      saveRemote(remote);
      update({ error: null, pending: read(KEYS.pending) === '1' });
    } catch (error) {
      console.warn('Backup failed', error);
      write(KEYS.pending, '1');
      update({ error: errorMessage(error), pending: true });
    } finally {
      running = null;
      update({ syncing: false });
      if (runAgain) {
        runAgain = false;
        schedule(500);
      }
    }
  })();
  return running;
}

function saveRemote(remote: RemoteBackup) {
  const at = Date.parse(remote.modifiedTime) || Date.now();
  write(KEYS.fileId, remote.id);
  write(KEYS.lastAt, String(at));
  update({ lastBackupAt: at });
}

async function applyRestore(database: SQLiteDatabase, snapshot: Snapshot, remote: RemoteBackup) {
  await restoreSnapshot(database, snapshot);
  saveRemote(remote);
  write(KEYS.pending, '0');
  update({ pending: false, error: null });
  // Every list reloads; Pin Note syncs its notifications from what it reads
  announceChange('notes');
  announceChange('links');
  announceChange('memos');
  announceChange('tasks');
}

function requireDb(): SQLiteDatabase {
  if (!db) throw new Error('The database is not open yet');
  return db;
}

export type FoundBackup = { remote: RemoteBackup; snapshot: Snapshot; counts: Counts; local: Counts };

export type SignInResult =
  | { kind: 'cancelled' }
  /** Nothing in Drive yet: this device's data is the first backup. */
  | { kind: 'backedUp' }
  /** The device was empty (a new phone, a reinstall): the backup is back. */
  | { kind: 'restored'; counts: Counts }
  /** Both have data: the user picks with resolveSignIn(). */
  | { kind: 'choose'; found: FoundBackup };

// Signed in but not yet in use, until the user picks which data to keep
let undecided: { account: Account; found: FoundBackup } | null = null;

export async function signInToBackup(): Promise<SignInResult> {
  const database = requireDb();
  const account = await signIn();
  if (!account) return { kind: 'cancelled' };
  const remote = await findBackup();
  if (!remote) {
    write(KEYS.fileId, null);
    update({ account });
    await backUp();
    if (state.error) throw new Error(state.error);
    return { kind: 'backedUp' };
  }
  let snapshot: Snapshot;
  try {
    snapshot = await download(remote);
  } catch (error) {
    // Not usable by this version: stay signed out rather than back up over it
    await signOut().catch(() => {});
    throw error;
  }
  const counts = countsOf(snapshot.tables);
  const local = await localCounts(database);
  if (isEmpty(local)) {
    await applyRestore(database, snapshot, remote);
    update({ account });
    return { kind: 'restored', counts };
  }
  undecided = { account, found: { remote, snapshot, counts, local } };
  return { kind: 'choose', found: undecided.found };
}

/** After 'choose': keep the backup, keep this device's data (it replaces the backup), or neither. */
export async function resolveSignIn(choice: 'restore' | 'keepDevice' | 'cancel'): Promise<void> {
  const pick = undecided;
  undecided = null;
  if (!pick) return;
  if (choice === 'cancel') {
    await signOut().catch(() => {});
    return;
  }
  if (choice === 'restore') {
    await applyRestore(requireDb(), pick.found.snapshot, pick.found.remote);
    update({ account: pick.account });
    return;
  }
  write(KEYS.fileId, pick.found.remote.id);
  update({ account: pick.account });
  await backUp();
  if (state.error) throw new Error(state.error);
}

/** What's in Drive now, to confirm before restoring it. */
export async function checkBackup(): Promise<FoundBackup | null> {
  const remote = await findBackup();
  if (!remote) return null;
  const snapshot = await download(remote);
  return { remote, snapshot, counts: countsOf(snapshot.tables), local: await localCounts(requireDb()) };
}

export async function restoreBackup(found: FoundBackup): Promise<void> {
  clearTimeout(timer);
  await applyRestore(requireDb(), found.snapshot, found.remote);
}

/** Signs out; the data stays on the device and in Drive. */
export async function signOutOfBackup(): Promise<void> {
  clearTimeout(timer);
  await signOut();
  write(KEYS.fileId, null);
  write(KEYS.lastAt, null);
  update({ account: null, lastBackupAt: null, error: null });
}

/** Deletes the Drive copy and signs out (signed in, the next change would make a new one). */
export async function deleteBackupAndSignOut(): Promise<void> {
  clearTimeout(timer);
  const remote = await findBackup();
  if (remote) await deleteBackup(remote.id);
  await signOutOfBackup();
}

let started = false;
function attach(database: SQLiteDatabase) {
  db = database;
  if (started) return;
  started = true;
  restoreSession()
    .then(async (account) => {
      // A sign-in that never got as far as using a backup (closed while asking which data to
      // keep): don't let it start uploading over the one in Drive
      if (account && !read(KEYS.fileId)) {
        await signOut().catch(() => {});
        account = null;
      }
      update({ account, ready: true });
      if (account && state.pending) schedule(1000);
    })
    .catch((error) => {
      console.warn('Could not restore the Google sign-in', error);
      update({ ready: true });
    });
}

/**
 * The data as a backup file (the same as the Drive backup), for "Save to a file" and "Share".
 * Call markFileExported once it's been written.
 */
export async function exportBackup(): Promise<{ text: string; counts: Counts; exportedAt: number }> {
  const snapshot = await takeSnapshot(requireDb());
  return { text: JSON.stringify(snapshot, null, 1), counts: countsOf(snapshot.tables), exportedAt: snapshot.exportedAt };
}

export function markFileExported(at: number) {
  write(KEYS.fileExportAt, String(at));
  update({ lastFileExportAt: at });
}

export type FoundFile = { snapshot: Snapshot; counts: Counts; local: Counts };

/**
 * A backup file's contents, checked and brought up to this app's schema. Throws
 * BackupInvalidError for anything that isn't a Zort backup, BackupTooNewError for one from a
 * newer version.
 */
export async function readBackupFile(text: string): Promise<FoundFile> {
  const snapshot = readSnapshot(text, DATABASE_VERSION);
  return { snapshot, counts: countsOf(snapshot.tables), local: await localCounts(requireDb()) };
}

/**
 * Replaces the data with a backup file's (in one transaction). Returns what was there before,
 * so it can be put back (Undo). Unlike a Drive restore this is new data for Drive: if signed in,
 * it's backed up there next.
 */
export async function restoreFromFile(snapshot: Snapshot): Promise<Snapshot> {
  const database = requireDb();
  const previous = await takeSnapshot(database);
  await restoreSnapshot(database, snapshot);
  for (const table of BACKUP_TABLES) announceChange(table);
  markPending();
  return previous;
}

/** Gives the backup the database; once per React tree, inside SQLiteProvider. */
export function BackupProvider({ children }: { children: ReactNode }) {
  const database = useSQLiteContext();
  useEffect(() => attach(database), [database]);
  return children;
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function useBackup(): BackupState {
  return useSyncExternalStore(subscribe, () => state);
}
