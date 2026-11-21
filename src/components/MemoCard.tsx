import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import type { Memo } from '@/lib/memos-db';
import { formatDateTime } from '@/lib/pin-status';
import { radius, spacing, useColors } from '@/lib/theme';

import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';

type Props = {
  memo: Memo;
  /** Opens the note's actions (copy, edit, delete). */
  onPress: (memo: Memo) => void;
  onToggleFavorite: (memo: Memo) => void;
};

export const MemoCard = memo(function MemoCard({ memo, onPress, onToggleFavorite }: Props) {
  const colors = useColors();
  const edited = t('editedAt', { date: formatDateTime(memo.updatedAt) });

  return (
    <Pressable
      onPress={() => onPress(memo)}
      onLongPress={() => onPress(memo)}
      accessibilityRole="button"
      accessibilityLabel={[memo.title, memo.body, edited].filter(Boolean).join('. ')}
      accessibilityHint={t('moreOptions')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {memo.title}
        </Text>
        {memo.body ? (
          <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={4}>
            {memo.body}
          </Text>
        ) : null}
        <Text style={[styles.date, { color: colors.textTertiary }]} numberOfLines={1}>
          {edited}
        </Text>
      </View>
      <View style={styles.trailing}>
        <FavoriteButton favorite={memo.favorite} onPress={() => onToggleFavorite(memo)} />
        <Icon name="more" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1, gap: spacing.xs },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  date: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: -spacing.sm },
});
