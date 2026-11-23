import { useColorScheme } from 'react-native';

import type { TranslationKey } from './i18n';

/**
 * The colors a label can have. Stored by name, not as a hex value, so each one can have its own
 * shade in the light and the dark theme (and a new palette never needs a migration).
 */
export const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/** A stored value this version doesn't know (e.g. from a newer backup) shows as gray. */
export const toLabelColor = (value: string): LabelColor =>
  (LABEL_COLORS as readonly string[]).includes(value) ? (value as LabelColor) : 'gray';

type Shade = {
  /** A note card's background: soft enough for the usual text colors on it. */
  surface: string;
  surfacePressed: string;
  /** The color itself: the swatch, the dot next to the name, the card's border. */
  strong: string;
};

// Primer's (zort.ing's) scales: the "subtle" background, a step darker when pressed, and the
// "emphasis" color; in the dark theme, deep tints that keep the light text readable
const light: Record<LabelColor, Shade> = {
  red: { surface: '#FFEBE9', surfacePressed: '#FFD8D3', strong: '#CF222E' },
  orange: { surface: '#FFF1E5', surfacePressed: '#FFE2CC', strong: '#BC4C00' },
  yellow: { surface: '#FFF8C5', surfacePressed: '#FFF0A3', strong: '#9A6700' },
  green: { surface: '#DAFBE1', surfacePressed: '#C6F2D1', strong: '#1A7F37' },
  teal: { surface: '#D8F6F1', surfacePressed: '#BDEDE5', strong: '#127A6E' },
  blue: { surface: '#DDF4FF', surfacePressed: '#C7EBFF', strong: '#0969DA' },
  purple: { surface: '#FBEFFF', surfacePressed: '#F3DBFF', strong: '#8250DF' },
  pink: { surface: '#FFEFF7', surfacePressed: '#FFD9EC', strong: '#BF3989' },
  gray: { surface: '#EFF2F5', surfacePressed: '#E1E6EB', strong: '#59636E' },
};

const dark: Record<LabelColor, Shade> = {
  red: { surface: '#3A1A1D', surfacePressed: '#4A2226', strong: '#F85149' },
  orange: { surface: '#3A2414', surfacePressed: '#4A2E1A', strong: '#DB6D28' },
  yellow: { surface: '#332A10', surfacePressed: '#423614', strong: '#D29922' },
  green: { surface: '#13301F', surfacePressed: '#193D28', strong: '#3FB950' },
  teal: { surface: '#0F2E2C', surfacePressed: '#143B38', strong: '#39C5BB' },
  blue: { surface: '#12263F', surfacePressed: '#183252', strong: '#4493F8' },
  purple: { surface: '#2A1B3D', surfacePressed: '#36234F', strong: '#AB7DF8' },
  pink: { surface: '#361B2C', surfacePressed: '#45233A', strong: '#DB61A2' },
  gray: { surface: '#262C36', surfacePressed: '#313844', strong: '#9198A1' },
};

/** The current theme's shades, by color name. */
export function useLabelShades(): Record<LabelColor, Shade> {
  return useColorScheme() === 'dark' ? dark : light;
}

/** What a screen reader calls each color. */
export const labelColorName: Record<LabelColor, TranslationKey> = {
  red: 'colorRed',
  orange: 'colorOrange',
  yellow: 'colorYellow',
  green: 'colorGreen',
  teal: 'colorTeal',
  blue: 'colorBlue',
  purple: 'colorPurple',
  pink: 'colorPink',
  gray: 'colorGray',
};
