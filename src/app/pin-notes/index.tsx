import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { NoteCard } from '@/components/NoteCard';
import { PermissionBanner } from '@/components/PermissionBanner';
import type { Note } from '@/lib/db';
import { animateReorder } from '@/lib/favorites';
import { t } from '@/lib/i18n';
import { useNotes } from '@/lib/notes-context';
import { isShown } from '@/lib/pin-status';
import { radius, spacing, useColors } from '@/lib/theme';

const FAB_SIZE = 60;

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notes, loaded, permission, now, removeNote, setPinned, setFavorite, requestPermission } = useNotes();
  // Favorites, then pinned notes, then the rest; each group keeps the newest first
  const sorted = useMemo(() => {
    const others = notes.filter((note) => !note.favorite);
    return [
      ...notes.filter((note) => note.favorite),
      ...others.filter((note) => note.pinned),
      ...others.filter((note) => !note.pinned),
    ];
  }, [notes]);

  const openNote = useCallback((note: Note) => {
    router.push({ pathname: '/pin-notes/[id]', params: { id: note.id } });
  }, []);

  const addNote = useCallback(() => {
    router.push({ pathname: '/pin-notes/[id]', params: { id: 'new' } });
  }, []);

  const confirmDelete = useCallback(
    (note: Note) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Alert.alert(t('deleteConfirmTitle'), `“${note.title}”\n\n${t('deleteConfirmMessage')}`, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => removeNote(note.id).catch(() => Alert.alert(t('deleteFailed'))),
        },
      ]);
    },
    [removeNote],
  );

  const togglePin = useCallback(
    (note: Note) => {
      Haptics.selectionAsync().catch(() => {});
      // Pinning moves the note between groups
      if (!note.favorite) animateReorder();
      setPinned(note.id, !note.pinned).catch(() => Alert.alert(t('saveFailed')));
    },
    [setPinned],
  );

  const toggleFavorite = useCallback(
    (note: Note) => {
      Haptics.selectionAsync().catch(() => {});
      animateReorder();
      setFavorite(note.id, !note.favorite).catch(() => Alert.alert(t('saveFailed')));
    },
    [setFavorite],
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  // Before the first pinned note there's nothing to show yet; permission is asked when it's saved
  const shownCount = notes.filter((note) => isShown(note, now)).length;
  const showBanner = notes.some((note) => note.pinned) && permission !== null && permission !== 'granted';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={sorted}
        keyExtractor={(note) => note.id}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            now={now}
            onPress={openNote}
            onLongPress={confirmDelete}
            onTogglePin={togglePin}
            onToggleFavorite={toggleFavorite}
          />
        )}
        extraData={now}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + FAB_SIZE + spacing.xxl },
          notes.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <>
            {showBanner ? <PermissionBanner onPress={requestPermission} /> : null}
            {notes.length > 0 ? (
              <Text style={[styles.count, { color: colors.textTertiary }]}>
                {notes.length === 1 ? t('countOne') : t('countMany', { n: notes.length })}
                {permission === 'granted' ? ` · ${t('shownCount', { n: shownCount })}` : ''}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={<EmptyState onAdd={addNote} />}
      />

      {notes.length > 0 ? (
        <Pressable
          onPress={addNote}
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
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="pin" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('emptyTitle')}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{t('emptyMessage')}</Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        ]}
      >
        <Icon name="add" size={20} color={colors.onAccent} />
        <Text style={[styles.emptyButtonText, { color: colors.onAccent }]}>{t('addFirstNote')}</Text>
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
