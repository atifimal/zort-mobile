import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import type { Link } from '@/lib/links-db';
import { radius, spacing, useColors } from '@/lib/theme';
import { displayHost, displayUrl, siteName } from '@/lib/url';

import { Icon } from './Icon';

type Props = {
  link: Link;
  /** Opens the link's actions (open, private tab, copy, edit, delete). */
  onPress: (link: Link) => void;
};

export const LinkCard = memo(function LinkCard({ link, onPress }: Props) {
  const colors = useColors();
  const host = displayHost(link.url);
  const title = link.title || host;

  return (
    <Pressable
      onPress={() => onPress(link)}
      // A long press does the same, for anyone used to holding for options
      onLongPress={() => onPress(link)}
      accessibilityRole="button"
      accessibilityHint={t('moreOptions')}
      accessibilityLabel={link.title ? `${link.title}, ${host}` : host}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      {/* The site's first letter: no favicon, which would mean asking a third party about every link */}
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.badgeText, { color: colors.accent }]}>{siteName(link.url).charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.url, { color: colors.textTertiary }]} numberOfLines={1}>
          {displayUrl(link.url)}
        </Text>
      </View>
      <Icon name="more" size={18} color={colors.textTertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 18, fontWeight: '700' },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  url: { fontSize: 13 },
});
