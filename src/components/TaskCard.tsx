import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { describeReminder, describeRepeat, formatDue } from '@/lib/task-format';
import { isLate } from '@/lib/task-logic';
import type { Task } from '@/lib/tasks-db';
import { radius, spacing, useColors } from '@/lib/theme';

import { Icon } from './Icon';

type Props = {
  task: Task;
  now: number;
  onPress: (task: Task) => void;
  onToggleDone: (task: Task) => void;
};

/** A task in the list: its check circle, title, due time (red once late) and repeat rule. */
export const TaskCard = memo(function TaskCard({ task, now, onPress, onToggleDone }: Props) {
  const colors = useColors();
  const done = task.completedAt !== null;
  const late = isLate(task, now);
  const due = task.due === null ? null : formatDue(task.due, now);
  const repeat = task.repeat && !done ? describeRepeat(task.repeat, now) : null;
  const dueColor = done ? colors.textTertiary : late ? colors.danger : colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={[
        task.title,
        task.body,
        due,
        late ? t('late') : null,
        task.reminder !== null && !done ? `${t('reminder')}: ${describeReminder(task.reminder)}` : null,
        repeat,
      ]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
      ]}
    >
      <CheckCircle done={done} late={late} onPress={() => onToggleDone(task)} />

      <View style={styles.texts}>
        <Text
          style={[styles.title, { color: done ? colors.textTertiary : colors.text }, done && styles.struck]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {task.body ? (
          <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
            {task.body}
          </Text>
        ) : null}
        {due || repeat ? (
          <View style={styles.meta}>
            {due ? (
              <View style={styles.metaItem}>
                <Icon name="calendar" size={13} color={dueColor} />
                <Text style={[styles.metaText, { color: dueColor }]} numberOfLines={1}>
                  {due}
                </Text>
                {task.reminder !== null && !done ? <Icon name="bell" size={13} color={dueColor} /> : null}
              </View>
            ) : null}
            {repeat ? (
              <View style={[styles.metaItem, styles.repeat]}>
                <Icon name="repeat" size={13} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.accent }]} numberOfLines={1}>
                  {repeat}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

/** The round check box: its own target, so checking a task off doesn't open it. */
function CheckCircle({ done, late, onPress }: { done: boolean; late: boolean; onPress: () => void }) {
  const colors = useColors();
  const ring = done ? colors.accent : late ? colors.danger : colors.textTertiary;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? t('markUndone') : t('markDone')}
      style={({ pressed }) => [styles.checkTarget, pressed && { opacity: 0.6 }]}
    >
      <View
        style={[
          styles.check,
          { borderColor: ring, backgroundColor: done ? colors.accent : 'transparent' },
        ]}
      >
        {done ? <Icon name="check" size={15} color={colors.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkTarget: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.sm + 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 3, paddingTop: 1 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  struck: { textDecorationLine: 'line-through', fontWeight: '500' },
  body: { fontSize: 14, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  repeat: { flexShrink: 1 },
  metaText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
