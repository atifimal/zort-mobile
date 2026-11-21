import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/ActionSheet';
import { Icon } from '@/components/Icon';
import { MemoCard } from '@/components/MemoCard';
import { useToast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';
import { t } from '@/lib/i18n';
import { useMemos } from '@/lib/memos-context';
import type { Memo } from '@/lib/memos-db';
import { radius, spacing, useColors } from '@/lib/theme';

const FAB_SIZE = 60;

/** What "Copy note" puts on the clipboard: the title, then the description below it. */
const memoText = (memo: Memo) => (memo.body ? `${memo.title}\n\n${memo.body}` : memo.title);

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { memos, loaded, removeMemo } = useMemos();
  const { toast, show } = useToast();
  const [selected, setSelected] = useState<Memo | null>(null);

  const showActions = useCallback((memo: Memo) => setSelected(memo), []);

  const addMemo = useCallback(() => {
    router.push({ pathname: '/notes/[id]', params: { id: 'new' } });
  }, []);

  const actionsFor = (memo: Memo): SheetAction[] => [
    {
      key: 'copy',
      label: t('copyNote'),
      icon: 'copy',
      onPress: () => copyText(memoText(memo), () => show(t('noteCopied'))).catch(() => Alert.alert(t('copyNoteFailed'))),
    },
    {
      key: 'edit',
      label: t('edit'),
      icon: 'edit',
      onPress: () => router.push({ pathname: '/notes/[id]', params: { id: memo.id } }),
    },
    {
      key: 'delete',
      label: t('delete'),
      icon: 'delete',
      destructive: true,
      onPress: () =>
        Alert.alert(t('deleteMemoTitle'), `“${memo.title}”`, [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => removeMemo(memo.id).catch(() => Alert.alert(t('deleteFailed'))),
          },
        ]),
    },
  ];

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={memos}
        keyExtractor={(memo) => memo.id}
        renderItem={({ item }) => <MemoCard memo={item} onPress={showActions} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + FAB_SIZE + spacing.xxl },
          memos.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          memos.length > 0 ? (
            <Text style={[styles.count, { color: colors.textTertiary }]}>
              {memos.length === 1 ? t('countOne') : t('countMany', { n: memos.length })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={<EmptyState onAdd={addMemo} />}
      />

      {memos.length > 0 ? (
        <Pressable
          onPress={addMemo}
          accessibilityRole="button"
          accessibilityLabel={t('addNote')}
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
        title={selected?.title ?? ''}
        subtitle={selected?.body ? selected.body.split('\n')[0] : undefined}
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
        <Icon name="note" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notesEmpty')}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{t('notesEmptyMessage')}</Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        ]}
      >
        <Icon name="add" size={20} color={colors.onAccent} />
        <Text style={[styles.emptyButtonText, { color: colors.onAccent }]}>{t('addNote')}</Text>
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
