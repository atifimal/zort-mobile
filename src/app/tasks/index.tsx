import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TaskCard } from '@/components/TaskCard';
import { useToast } from '@/components/Toast';
import { animateReorder } from '@/lib/favorites';
import { t } from '@/lib/i18n';
import { formatDue, sectionTitle } from '@/lib/task-format';
import { groupTasks, type TaskSection } from '@/lib/task-logic';
import { useTasks } from '@/lib/tasks-context';
import type { Task } from '@/lib/tasks-db';
import { radius, spacing, useColors } from '@/lib/theme';

const FAB_SIZE = 60;

type Section = { section: TaskSection; data: Task[]; count: number };

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, loaded, now, complete, restore, setFavorite, clearCompleted } = useTasks();
  // Above the + button, which sits where the toast would
  const { toast, show } = useToast({ above: FAB_SIZE });
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => groupTasks(tasks, now), [tasks, now]);
  const todoCount = tasks.filter((task) => task.completedAt === null).length;
  const doneCount = tasks.length - todoCount;
  // The completed group folds away; its header stays to open it
  const sections: Section[] = groups.map(({ section, tasks: items }) => ({
    section,
    data: section === 'done' && !showDone ? [] : items,
    count: items.length,
  }));

  const open = useCallback((task: Task) => {
    router.push({ pathname: '/tasks/[id]', params: { id: task.id } });
  }, []);

  const addTask = useCallback(() => {
    router.push({ pathname: '/tasks/[id]', params: { id: 'new' } });
  }, []);

  const toggleDone = useCallback(
    async (task: Task) => {
      animateReorder();
      try {
        if (task.completedAt !== null) {
          Haptics.selectionAsync().catch(() => {});
          await restore(task);
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const { previous, task: after } = await complete(task.id);
        const undo = {
          label: t('undo'),
          onPress: () => {
            animateReorder();
            restore(previous).catch(() => Alert.alert(t('taskSaveFailed')));
          },
        };
        // A repeating task stays in the list, moved on: say where it went
        if (after.completedAt === null && after.due !== null) show(t('taskMovedOn', { date: formatDue(after.due) }), undo);
        else show(t('taskDone'), undo);
      } catch (error) {
        console.error(error);
        Alert.alert(t('taskSaveFailed'));
      }
    },
    [complete, restore, show],
  );

  const toggleFavorite = useCallback(
    (task: Task) => {
      Haptics.selectionAsync().catch(() => {});
      animateReorder();
      setFavorite(task.id, !task.favorite).catch(() => Alert.alert(t('taskSaveFailed')));
    },
    [setFavorite],
  );

  const confirmClear = () => {
    Alert.alert(t('clearCompletedTitle'), doneCount === 1 ? t('clearCompletedOne') : t('clearCompletedMany', { n: doneCount }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          animateReorder();
          clearCompleted().catch(() => Alert.alert(t('taskDeleteFailed')));
        },
      },
    ]);
  };

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(task) => task.id}
        renderItem={({ item }) => (
          <TaskCard task={item} now={now} onPress={open} onToggleDone={toggleDone} onToggleFavorite={toggleFavorite} />
        )}
        renderSectionHeader={({ section }) =>
          section.section === 'done' ? (
            <DoneHeader count={section.count} open={showDone} onToggle={() => {
              animateReorder();
              setShowDone((value) => !value);
            }} onClear={confirmClear} />
          ) : (
            <SectionHeader section={section.section} count={section.count} />
          )
        }
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + FAB_SIZE + spacing.xxl },
          tasks.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          tasks.length === 0 ? undefined : todoCount === 0 ? (
            <AllDone />
          ) : (
            <Text style={[styles.count, { color: colors.textTertiary }]}>
              {todoCount === 1 ? t('tasksCountOne') : t('tasksCountMany', { n: todoCount })}
            </Text>
          )
        }
        ListEmptyComponent={<EmptyState onAdd={addTask} />}
      />

      {tasks.length > 0 ? (
        <Pressable
          onPress={addTask}
          accessibilityRole="button"
          accessibilityLabel={t('addTask')}
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

      {toast}
    </View>
  );
}

function SectionHeader({ section, count }: { section: TaskSection; count: number }) {
  const colors = useColors();
  const color = section === 'overdue' ? colors.danger : section === 'today' ? colors.accent : colors.textSecondary;
  return (
    <View style={styles.sectionHeader} accessibilityRole="header">
      <Text style={[styles.sectionTitle, { color }]}>{sectionTitle(section)}</Text>
      <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>{count}</Text>
    </View>
  );
}

function DoneHeader({
  count,
  open,
  onToggle,
  onClear,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.doneToggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{sectionTitle('done')}</Text>
        <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>{count}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="expand" size={18} color={colors.textTertiary} />
        </View>
      </Pressable>
      {open ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[styles.clear, { color: colors.danger }]}>{t('clearCompleted')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AllDone() {
  const colors = useColors();
  return (
    <View style={[styles.allDone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.allDoneIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name="check" size={20} color={colors.accent} />
      </View>
      <Text style={[styles.allDoneText, { color: colors.text }]}>{t('tasksAllDone')}</Text>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="task" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('tasksEmptyTitle')}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{t('tasksEmptyMessage')}</Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [styles.emptyButton, { backgroundColor: pressed ? colors.accentPressed : colors.accent }]}
      >
        <Icon name="add" size={20} color={colors.onAccent} />
        <Text style={[styles.emptyButtonText, { color: colors.onAccent }]}>{t('addTask')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 13, fontWeight: '500', marginLeft: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCount: { fontSize: 14, fontWeight: '600', marginLeft: spacing.sm, marginRight: 'auto' },
  doneToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  clear: { fontSize: 14, fontWeight: '600' },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  allDoneIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  allDoneText: { fontSize: 16, fontWeight: '600' },
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
