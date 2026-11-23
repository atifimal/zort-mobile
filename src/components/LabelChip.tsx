import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLabelShades, type LabelColor } from '@/lib/label-colors';
import { radius, spacing, useColors } from '@/lib/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  text: string;
  /** Left out for the choices that aren't a label ("None", "All"). */
  color?: LabelColor;
  selected: boolean;
  onPress: () => void;
  /** Instead of the color dot; makes it a button rather than one of the choices. */
  icon?: IconName;
  accessibilityLabel?: string;
};

/** A label to choose: in the note editor, and to show only one label's notes in the list. */
export function LabelChip({ text, color, selected, onPress, icon, accessibilityLabel }: Props) {
  const colors = useColors();
  const shades = useLabelShades();
  const shade = color ? shades[color] : undefined;
  const selectedBorder = shade?.strong ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      // With an icon it's an action (e.g. edit the labels), not one of the choices
      accessibilityRole={icon ? 'button' : 'radio'}
      accessibilityState={icon ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? text}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed
            ? (shade?.surfacePressed ?? colors.surfacePressed)
            : selected
              ? (shade?.surface ?? colors.accentSoft)
              : colors.surface,
          borderColor: selected ? selectedBorder : colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={15} color={colors.textSecondary} />
      ) : shade ? (
        <View style={[styles.dot, { backgroundColor: shade.strong }]} />
      ) : null}
      {text ? (
        <Text
          style={[styles.text, { color: selected ? colors.text : colors.textSecondary }, selected && styles.textSelected]}
          numberOfLines={1}
        >
          {text}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A note card's label: the color dot and the name. */
export function LabelTag({ name, color }: { name: string; color: LabelColor }) {
  const colors = useColors();
  const shades = useLabelShades();

  return (
    <View style={styles.tag}>
      <View style={[styles.tagDot, { backgroundColor: shades[color].strong }]} />
      <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    maxWidth: 220,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  textSelected: { fontWeight: '600' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
