import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { PinWindow } from '@/lib/db';
import { t } from '@/lib/i18n';
import { radius, spacing, useColors } from '@/lib/theme';

import { DateTimeField } from './DateTimeField';
import { Icon } from './Icon';

type Props = {
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  always: boolean;
  onAlwaysChange: (always: boolean) => void;
  window: PinWindow;
  onWindowChange: (window: PinWindow) => void;
  /** Shown under the card in place of the hint, e.g. the window ends before it starts. */
  error?: string;
};

/** The editor's notification settings: pinned or not, and always or between two times. */
export function PinSettings({ pinned, onPinnedChange, always, onAlwaysChange, window, onWindowChange, error }: Props) {
  const colors = useColors();
  const windowDisabled = !pinned || always;

  const hint = !pinned ? t('editorOff') : always ? t('editorAlways') : t('editorWindow');

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Icon name={pinned ? 'pin' : 'pinOff'} size={18} color={pinned ? colors.accent : colors.textTertiary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('pinToNotifications')}</Text>
          <Switch
            value={pinned}
            onValueChange={(value) => {
              Haptics.selectionAsync().catch(() => {});
              onPinnedChange(value);
            }}
            trackColor={{ true: colors.accent, false: colors.border }}
            // Android's default thumb takes the theme's teal; iOS draws its own white thumb
            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            accessibilityLabel={t('pinToNotifications')}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Pressable
          onPress={() => onAlwaysChange(!always)}
          disabled={!pinned}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: always, disabled: !pinned }}
          style={({ pressed }) => [
            styles.row,
            !pinned && styles.disabled,
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <Icon
            name={always ? 'checkboxOn' : 'checkboxOff'}
            size={22}
            color={always ? colors.accent : colors.textTertiary}
          />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('always')}</Text>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <DateTimeField
          label={t('starts')}
          value={window.start}
          // Moving the start keeps the length of the window, so the end stays after it
          onChange={(start) => onWindowChange({ start, end: start + (window.end - window.start) })}
          disabled={windowDisabled}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <DateTimeField
          label={t('ends')}
          value={window.end}
          minimum={window.start}
          onChange={(end) => onWindowChange({ ...window, end })}
          disabled={windowDisabled}
        />
      </View>

      <View style={styles.hint}>
        {error ? null : <Icon name={pinned ? 'pin' : 'pinOff'} size={14} color={colors.textTertiary} />}
        <Text
          style={[styles.hintText, { color: error ? colors.danger : colors.textTertiary }]}
          accessibilityLiveRegion="polite"
        >
          {error ?? hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  disabled: { opacity: 0.4 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.xs },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
