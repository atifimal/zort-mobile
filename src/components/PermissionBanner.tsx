import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { radius, spacing, useColors } from '@/lib/theme';

import { Icon } from './Icon';

export function PermissionBanner({ onPress }: { onPress: () => void }) {
  const colors = useColors();

  return (
    <View style={[styles.banner, { backgroundColor: colors.warningSurface }]} accessibilityRole="alert">
      <Icon name="notificationsOff" size={20} color={colors.warningText} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.warningText }]}>{t('permissionTitle')}</Text>
        <Text style={[styles.message, { color: colors.warningText }]}>{t('permissionMessage')}</Text>
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.warningText, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.actionText, { color: colors.warningSurface }]}>{t('permissionAction')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  message: { fontSize: 13, lineHeight: 18 },
  action: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  actionText: { fontSize: 14, fontWeight: '600' },
});
