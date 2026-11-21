import { useColors } from './theme';

/** Header and background styling shared by every stack in the app. */
export function useStackScreenOptions() {
  const colors = useColors();
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}
