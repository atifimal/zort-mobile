import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/ActionSheet';
import { Icon } from '@/components/Icon';
import { LinkCard } from '@/components/LinkCard';
import { useToast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';
import { animateReorder, favoritesFirst } from '@/lib/favorites';
import { t } from '@/lib/i18n';
import { useLinks } from '@/lib/links-context';
import type { Link } from '@/lib/links-db';
import { openLink, openLinkPrivately, usePrivateBrowser } from '@/lib/open-link';
import { radius, spacing, useColors } from '@/lib/theme';
import { displayHost, displayUrl } from '@/lib/url';

const FAB_SIZE = 60;

export default function LinksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { links, loaded, setFavorite, removeLink } = useLinks();
  const sorted = useMemo(() => favoritesFirst(links), [links]);
  const privateBrowser = usePrivateBrowser();
  const { toast, show } = useToast();
  const [selected, setSelected] = useState<Link | null>(null);

  const open = useCallback((link: Link) => {
    openLink(link.url).catch(() => Alert.alert(t('openFailed')));
  }, []);

  // A tap shows the actions; opening in the browser is one of them
  const showActions = useCallback((link: Link) => setSelected(link), []);

  const toggleFavorite = useCallback(
    (link: Link) => {
      Haptics.selectionAsync().catch(() => {});
      animateReorder();
      setFavorite(link.id, !link.favorite).catch(() => Alert.alert(t('saveFailed')));
    },
    [setFavorite],
  );

  const addLink = useCallback(() => {
    router.push({ pathname: '/links/[id]', params: { id: 'new' } });
  }, []);

  const actionsFor = (link: Link): SheetAction[] => [
    { key: 'open', label: t('open'), icon: 'open', onPress: () => open(link) },
    ...(privateBrowser
      ? [
          {
            key: 'private',
            label: t('openPrivate'),
            hint: t('openPrivateHint', { browser: privateBrowser.label }),
            icon: 'privateTab' as const,
            onPress: () => openLinkPrivately(link.url, privateBrowser).catch(() => Alert.alert(t('openFailed'))),
          },
        ]
      : []),
    {
      key: 'copy',
      label: t('copyLink'),
      icon: 'copy',
      onPress: () => copyText(link.url, () => show(t('linkCopied'))).catch(() => Alert.alert(t('copyFailed'))),
    },
    {
      key: 'favorite',
      label: link.favorite ? t('removeFavorite') : t('addFavorite'),
      icon: link.favorite ? 'starFill' : 'star',
      onPress: () => toggleFavorite(link),
    },
    {
      key: 'edit',
      label: t('edit'),
      icon: 'edit',
      onPress: () => router.push({ pathname: '/links/[id]', params: { id: link.id } }),
    },
    {
      key: 'delete',
      label: t('delete'),
      icon: 'delete',
      destructive: true,
      onPress: () =>
        Alert.alert(t('deleteLinkTitle'), link.title ? `“${link.title}”` : displayUrl(link.url), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => removeLink(link.id).catch(() => Alert.alert(t('deleteFailed'))),
          },
        ]),
    },
  ];

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sorted}
        keyExtractor={(link) => link.id}
        renderItem={({ item }) => <LinkCard link={item} onPress={showActions} onToggleFavorite={toggleFavorite} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + FAB_SIZE + spacing.xxl },
          links.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          links.length > 0 ? (
            <Text style={[styles.count, { color: colors.textTertiary }]}>
              {links.length === 1 ? t('linksCountOne') : t('linksCountMany', { n: links.length })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={<EmptyState onAdd={addLink} />}
      />

      {links.length > 0 ? (
        <Pressable
          onPress={addLink}
          accessibilityRole="button"
          accessibilityLabel={t('addLink')}
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: insets.bottom + spacing.xl,
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
              shadowColor: colors.accent,
            },
          ]}
        >
          <Icon name="add" size={28} color={colors.onAccent} />
        </Pressable>
      ) : null}

      <ActionSheet
        visible={selected !== null}
        title={selected ? selected.title || displayHost(selected.url) : ''}
        subtitle={selected ? displayUrl(selected.url) : undefined}
        actions={selected ? actionsFor(selected) : []}
        onClose={() => setSelected(null)}
      />

      {toast}
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="link" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('linksEmptyTitle')}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{t('linksEmptyMessage')}</Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        ]}
      >
        <Icon name="add" size={20} color={colors.onAccent} />
        <Text style={[styles.emptyButtonText, { color: colors.onAccent }]}>{t('addLink')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 13, fontWeight: '500', marginBottom: spacing.md, marginLeft: spacing.xs },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 80,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyMessage: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: { fontSize: 16, fontWeight: '600' },
});
