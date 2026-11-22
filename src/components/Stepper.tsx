import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { radius, spacing, useColors } from '@/lib/theme';

import { Icon } from './Icon';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Read out with the value, e.g. "weeks". */
  label: string;
  disabled?: boolean;
};

/** − value + : a small whole number, like the 2 in "every 2 weeks". */
export function Stepper({ value, onChange, min = 1, max, label, disabled }: Props) {
  const colors = useColors();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const button = (delta: number) => {
    const blocked = disabled || (delta < 0 ? value <= min : value >= max);
    return (
      <Pressable
        onPress={() => step(delta)}
        disabled={blocked}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={delta < 0 ? t('decrease') : t('increase')}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? colors.surfacePressed : colors.background, opacity: blocked ? 0.35 : 1 },
        ]}
      >
        <Icon name={delta < 0 ? 'minus' : 'add'} size={18} color={colors.accent} />
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.stepper, disabled && styles.disabled]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {button(-1)}
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {button(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  disabled: { opacity: 0.4 },
  button: { width: 36, height: 36, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 32, textAlign: 'center', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
