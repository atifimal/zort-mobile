import { Stack } from 'expo-router';

import { t } from '@/lib/i18n';
import { useStackScreenOptions } from '@/lib/stack-options';

// A note opened from its notification lands on the editor with the note list underneath
export const unstable_settings = { anchor: 'index' };

export default function PinNotesLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('pinNoteTitle'), headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}
