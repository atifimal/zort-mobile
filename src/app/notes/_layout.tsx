import { Stack } from 'expo-router';

import { t } from '@/lib/i18n';
import { useStackScreenOptions } from '@/lib/stack-options';

export default function NotesLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('notesTitle'), headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}
