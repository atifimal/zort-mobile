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
  sun: { ios: 'sun.max.fill', android: 'light_mode' },
  moon: { ios: 'moon.fill', android: 'dark_mode' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <SymbolView name={icons[name]} size={size} tintColor={color} weight="semibold" />;
}
