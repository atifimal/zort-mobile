import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

import { Icon } from './Icon';

type Props = { favorite: boolean; onPress: () => void };

/** The star on a list card: its own target, so marking a favorite doesn't open the item. */
export function FavoriteButton({ favorite, onPress }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityLabel={t('favorite')}
      accessibilityState={{ checked: favorite }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: favorite ? colors.favoriteSoft : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon
        name={favorite ? 'starFill' : 'star'}
        size={20}
        color={favorite ? colors.favorite : colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
