import { useNavigation, useRoute } from 'expo-router';
import { useEffect } from 'react';

/**
 * For an editor opened straight from a link (a Pin Note notification, the widget's "Open in
 * app"): it can be the only screen in its tool's stack (the layout's anchor isn't applied when
 * the app starts from a link), so Back would skip the list. This puts the list underneath,
 * keeping the editor as it is.
 */
export function useListUnderneath() {
  const navigation = useNavigation();
  const route = useRoute();
  useEffect(() => {
    const state = navigation.getState();
    if (!state || state.routes.length !== 1 || state.routes[0]?.key !== route.key) return;
    navigation.reset({
      index: 1,
      routes: [{ name: 'index' }, { name: route.name, key: route.key, params: route.params }],
    } as Parameters<typeof navigation.reset>[0]);
    // Only when the editor first opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
