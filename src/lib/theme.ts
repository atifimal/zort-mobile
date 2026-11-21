import { useColorScheme } from 'react-native';

// The same palette as zort.ing (style.css), so the app and the site feel like one product
const light = {
  background: '#F6F8FA',
  surface: '#FFFFFF',
  surfacePressed: '#EEF1F4',
  text: '#1F2328',
  textSecondary: '#59636E',
  textTertiary: '#818B98',
  border: '#D1D9E0',
  accent: '#0969DA',
  accentPressed: '#0757B5',
  onAccent: '#FFFFFF',
  accentSoft: '#DDF4FF',
  danger: '#D1242F',
  warningSurface: '#FFF8C5',
  warningText: '#7D4E00',
  favorite: '#BF8700',
  favoriteSoft: '#FFF8C5',
};

export type Colors = typeof light;

const dark: Colors = {
  background: '#151B23',
  surface: '#0D1117',
  surfacePressed: '#212830',
  text: '#E6EDF3',
  textSecondary: '#9198A1',
  textTertiary: '#6E7681',
  border: '#3D444D',
  accent: '#4493F8',
  accentPressed: '#2F81F7',
  onAccent: '#FFFFFF',
  accentSoft: '#12263F',
  danger: '#F85149',
  warningSurface: '#2E2410',
  warningText: '#D29922',
  favorite: '#E3B341',
  favoriteSoft: '#2E2410',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { md: 12, lg: 16, pill: 999 } as const;

/** Limits that keep a note readable in a notification. */
export const limits = { title: 100, body: 1000 } as const;
