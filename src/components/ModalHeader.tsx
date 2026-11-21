import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/lib/i18n';
import { spacing, useColors } from '@/lib/theme';

type Props = {
  title: string;
  onCancel: () => void;
  /** Omitted: no Save button (e.g. the item no longer exists). */
  onSave?: () => void;
  canSave?: boolean;
};

/**
 * Cancel / title / Save bar of the editor modals. Our own bar rather than the native header's
 * headerLeft/headerRight: react-native-screens on Android crashes ("child already has a
 * parent") when those re-render while the modal closes.
 */
export function ModalHeader({ title, onCancel, onSave, canSave = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        // The iOS sheet starts below the status bar; Android's modal covers the whole screen
        { paddingTop: Platform.OS === 'android' ? insets.top : 0, borderBottomColor: colors.border },
      ]}
    >
      <HeaderButton label={t('cancel')} onPress={onCancel} color={colors.accent} />
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {onSave ? (
        <HeaderButton
          label={t('save')}
          onPress={onSave}
          disabled={!canSave}
          color={canSave ? colors.accent : colors.textTertiary}
          bold
        />
      ) : (
        <View />
      )}
    </View>
  );
}

function HeaderButton({
  label,
  onPress,
  color,
  disabled,
  bold,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  bold?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={12} accessibilityRole="button">
      {({ pressed }) => (
        <Text style={[styles.button, { color, opacity: pressed ? 0.6 : 1 }, bold && styles.buttonBold]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  button: { fontSize: 17, paddingVertical: spacing.md },
  buttonBold: { fontWeight: '600' },
});
