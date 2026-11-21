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
};

/**
 * - granted: notifications can be shown
 * - undetermined: never asked (iOS only; Android reports denied until granted)
 * - denied: not allowed, or turned off in system settings
 */
export type PermissionStatus = 'granted' | 'undetermined' | 'denied';

type Events = {
  onNoteOpen(event: { id: string }): void;
};

declare class PinnedNotificationsNativeModule extends NativeModule<Events> {
  sync(notes: PinnedNote[]): Promise<void>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  consumePendingNoteOpen(): Promise<string | null>;
}

const native = requireNativeModule<PinnedNotificationsNativeModule>('PinnedNotifications');

/**
 * Makes the notifications match `notes` exactly: one per note, removed when the note is gone.
 * Idempotent and cheap to call after every change; unchanged notes are not re-posted.
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
