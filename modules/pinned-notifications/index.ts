import { NativeModule, requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type PinnedNote = {
  id: string;
  title: string;
  body: string;
  /** Opened when the notification is tapped (Android). */
  url?: string;
  /** Higher sorts first. */
  sortKey: number;
  /**
   * Optional time window (ms since epoch): the notification appears at `startsAt` and goes
   * away at `endsAt`. Either end can be left open. Handled natively, so it works while the
   * app is closed.
   */
  startsAt?: number | null;
  endsAt?: number | null;
};

/**
 * What the user did from a note's notification (its Unpin and Delete buttons). Applied
 * natively right away (the notification goes); the app applies it to its own data with
 * `getPendingNoteActions` and confirms with `acknowledgeNoteActions`.
 */
export type NoteAction = { id: string; action: 'unpin' | 'delete' };

/**
 * - granted: notifications can be shown
 * - undetermined: never asked (iOS only; Android reports denied until granted)
 * - denied: not allowed, or turned off in system settings
 */
export type PermissionStatus = 'granted' | 'undetermined' | 'denied';

type Events = {
  onNoteOpen(event: { id: string }): void;
  onNoteAction(): void;
};

declare class PinnedNotificationsNativeModule extends NativeModule<Events> {
  sync(notes: PinnedNote[]): Promise<void>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  consumePendingNoteOpen(): Promise<string | null>;
  getPendingActions(): Promise<NoteAction[]>;
  acknowledgeActions(ids: string[]): Promise<void>;
}

const native = requireNativeModule<PinnedNotificationsNativeModule>('PinnedNotifications');

/**
 * Makes the notifications match `notes` exactly: one per note while inside its time window,
 * removed when the note is gone. Idempotent and cheap to call after every change; unchanged
 * notes are not re-posted. Notes with an action still waiting to be acknowledged are left out,
 * so a list read before the action was applied can't bring an unpinned note back.
 */
export function syncPinnedNotes(notes: PinnedNote[]): Promise<void> {
  return native.sync(notes);
}

export function getPermissionStatus(): Promise<PermissionStatus> {
  return native.getPermissionStatus();
}

/**
 * Shows the system permission dialog if the system still allows it. Otherwise, with
 * `openSettings` (the default), opens the app's system settings so the user can turn
 * notifications on there; without it, just reports the status.
 */
export async function requestPermission({ openSettings = true } = {}): Promise<PermissionStatus> {
  const fallBackToSettings = async () => {
    if (openSettings) await Linking.openSettings();
    return native.getPermissionStatus();
  };

  if (Platform.OS === 'android') {
    if ((await native.getPermissionStatus()) === 'granted') return 'granted';

    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const hasRuntimePermission = typeof Platform.Version === 'number' && Platform.Version >= 33;
    if (hasRuntimePermission && !(await PermissionsAndroid.check(permission))) {
      const result = await PermissionsAndroid.request(permission);
      // The system no longer shows the dialog after the user declined it twice
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return fallBackToSettings();
      return native.getPermissionStatus();
    }

    // Allowed, but notifications are switched off for the app or its channel
    return fallBackToSettings();
  }

  const current = await native.getPermissionStatus();
  if (current === 'undetermined') return native.requestPermission();
  if (current === 'denied') return fallBackToSettings();
  return current;
}

/** iOS: a note the user tapped in Notification Center before the app was listening. */
export function consumePendingNoteOpen(): Promise<string | null> {
  return native.consumePendingNoteOpen();
}

/** iOS: called when the user taps a note's notification while the app is running. */
export function addNoteOpenListener(listener: (id: string) => void): EventSubscription {
  return native.addListener('onNoteOpen', ({ id }) => listener(id));
}

/** Unpin / Delete taps from notifications that the app hasn't applied to its data yet. */
export function getPendingNoteActions(): Promise<NoteAction[]> {
  return native.getPendingActions();
}

/** The app has applied these notes' actions to its data: forget them. */
export function acknowledgeNoteActions(ids: string[]): Promise<void> {
  return native.acknowledgeActions(ids);
}

/** Called when the user taps Unpin or Delete on a notification while the app is running. */
export function addNoteActionListener(listener: () => void): EventSubscription {
  return native.addListener('onNoteAction', listener);
}
