import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { addNoteOpenListener, consumePendingNoteOpen } from '@modules/pinned-notifications';

import { BackupProvider } from '@/lib/backup';
import { migrate } from '@/lib/db';
import { t } from '@/lib/i18n';
import { LinksProvider } from '@/lib/links-context';
import { MemosProvider } from '@/lib/memos-context';
import { NotesProvider, useNotes } from '@/lib/notes-context';
import { TasksProvider } from '@/lib/tasks-context';
import { useStackScreenOptions } from '@/lib/stack-options';
import { applySavedTheme } from '@/lib/theme-preference';

SplashScreen.preventAutoHideAsync().catch(() => {});
applySavedTheme();

// A link into a tool (a Pin Note notification, say) keeps the home screen underneath
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <SQLiteProvider databaseName="zort.db" onInit={migrate}>
      {/* Drive backup: gets every change, from here and from the widget's quick-add window */}
      <BackupProvider>
        {/* At the root, not inside Pin Note: notifications are kept in sync even when the app
            opens on another screen */}
        <NotesProvider>
          <LinksProvider>
            <MemosProvider>
              <TasksProvider>
                <HideSplashWhenLoaded />
                <OpenNotesFromNotifications />
                <StatusBar style="auto" />
                <Stack screenOptions={screenOptions}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="pin-notes" options={{ headerShown: false }} />
                  <Stack.Screen name="links" options={{ headerShown: false }} />
                  <Stack.Screen name="notes" options={{ headerShown: false }} />
                  <Stack.Screen name="tasks" options={{ headerShown: false }} />
                  <Stack.Screen name="backup" options={{ title: t('backupTitle') }} />
                </Stack>
              </TasksProvider>
            </MemosProvider>
          </LinksProvider>
        </NotesProvider>
      </BackupProvider>
    </SQLiteProvider>
  );
}

function HideSplashWhenLoaded() {
  const { loaded } = useNotes();
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);
  return null;
}

/**
 * iOS: tapping a note in Notification Center opens its editor. (Android does the same through
 * the zort://pin-notes/<id> link in the notification, which Expo Router handles by itself.)
 */
function OpenNotesFromNotifications() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const open = (id: string) => router.navigate({ pathname: '/pin-notes/[id]', params: { id } });
    const subscription = addNoteOpenListener(open);
    consumePendingNoteOpen()
      .then((id) => id && open(id))
      .catch(() => {});
    return () => subscription.remove();
  }, []);
  return null;
}
