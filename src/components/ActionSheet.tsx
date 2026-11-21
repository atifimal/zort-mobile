import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useColors } from '@/lib/theme';

import { Icon, type IconName } from './Icon';

export type SheetAction = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** A second line under the label. */
  hint?: string;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/**
 * A small sheet of actions from the bottom of the screen (opened by a long press). The chosen
 * action runs once the sheet has closed, so it can open a screen, an alert or another app
 * without the sheet's modal in the way.
 */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pending = useRef<(() => void) | null>(null);

  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const choose = (action: SheetAction) => {
    pending.current = action.onPress;
    onClose();
    // iOS reports when the modal is gone (onDismiss); Android removes it right away
    if (Platform.OS !== 'ios') runPending();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={runPending}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {actions.map((action) => {
            const color = action.destructive ? colors.danger : colors.text;
            return (
              <Pressable
                key={action.key}
                onPress={() => choose(action)}
                accessibilityRole="button"
                accessibilityHint={action.hint}
                style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfacePressed }]}
              >
                <Icon name={action.icon} size={20} color={action.destructive ? colors.danger : colors.textSecondary} />
                <View style={styles.actionTexts}>
                  <Text style={[styles.actionLabel, { color }]}>{action.label}</Text>
                  {action.hint ? (
                    <Text style={[styles.actionHint, { color: colors.textTertiary }]} numberOfLines={2}>
                      {action.hint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing.sm },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 13 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  actionTexts: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 16 },
  actionHint: { fontSize: 12, lineHeight: 16 },
});
