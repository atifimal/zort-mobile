import Storage from 'expo-sqlite/kv-store';
import { Appearance, useColorScheme } from 'react-native';

// Light / dark pick from the home screen switch. Until one is picked the app follows the
// phone's theme; a pick is saved on the device and applied again at the next launch.
const KEY = 'theme';

type Theme = 'light' | 'dark';

function saved(): Theme | null {
  try {
    const value = Storage.getItemSync(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Applies the saved pick. Called once, before the first screen draws. */
export function applySavedTheme() {
  const theme = saved();
  if (theme) Appearance.setColorScheme(theme);
}

/** The theme on screen and a function that switches to the other one and remembers it. */
export function useThemeToggle() {
  const dark = useColorScheme() === 'dark';
  const toggle = () => {
    const next: Theme = dark ? 'light' : 'dark';
    Appearance.setColorScheme(next);
    try {
      Storage.setItemSync(KEY, next);
    } catch {
      // Not saved: the pick lasts until the app is closed
    }
  };
  return { dark, toggle };
}
