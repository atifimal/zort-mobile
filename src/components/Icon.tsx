import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** The few icons the app uses, as SF Symbols on iOS and Material Symbols on Android. */
const icons = {
  add: { ios: 'plus', android: 'add' },
  pin: { ios: 'pin.fill', android: 'push_pin' },
  pinOff: { ios: 'pin.slash', android: 'keep_off' },
  clock: { ios: 'clock', android: 'schedule' },
  checkboxOn: { ios: 'checkmark.square.fill', android: 'check_box' },
  checkboxOff: { ios: 'square', android: 'check_box_outline_blank' },
  notificationsOff: { ios: 'bell.slash.fill', android: 'notifications_off' },
  delete: { ios: 'trash', android: 'delete' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  link: { ios: 'link', android: 'link' },
  open: { ios: 'arrow.up.right.square', android: 'open_in_browser' },
  privateTab: { ios: 'eye.slash', android: 'visibility_off' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  edit: { ios: 'pencil', android: 'edit' },
  note: { ios: 'note.text', android: 'notes' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  star: { ios: 'star', android: 'star_outline' },
  starFill: { ios: 'star.fill', android: 'star' },
  sun: { ios: 'sun.max.fill', android: 'light_mode' },
  moon: { ios: 'moon.fill', android: 'dark_mode' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof icons;

/**
 * Android draws Material Symbols from the outlined font, so filled icons need their own font.
 * Only the filled star is used: assets/fonts/star-filled.ttf holds just that glyph
 * (scripts/make-star-font.mjs), instead of the 1.4 MB filled font.
 */
const androidFonts: Partial<Record<IconName, { name: string; font: number }>> = {
  starFill: { name: 'ZortStarFilled', font: require('../../assets/fonts/star-filled.ttf') },
};

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  const androidFont = androidFonts[name];
  return (
    <SymbolView
      // SymbolView loads its font once, when it mounts: a new font needs a new view
      key={androidFont?.name ?? 'default'}
      name={icons[name]}
      size={size}
      tintColor={color}
      weight={androidFont ? { ios: 'semibold', android: androidFont } : 'semibold'}
    />
  );
}
