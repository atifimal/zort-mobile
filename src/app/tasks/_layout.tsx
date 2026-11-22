import { Stack } from 'expo-router';

import { t } from '@/lib/i18n';
import { useStackScreenOptions } from '@/lib/stack-options';

// A link straight to an editor (from the widget) keeps the list underneath
export const unstable_settings = { anchor: 'index' };

export default function TasksLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('tasksTitle'), headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}
