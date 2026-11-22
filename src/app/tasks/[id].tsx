import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/DateTimeField';
import { Icon } from '@/components/Icon';
import { ModalHeader } from '@/components/ModalHeader';
import { RepeatSettings } from '@/components/RepeatSettings';
import { t } from '@/lib/i18n';
import { normalizeRepeat, sameRepeat, startOfDay, type Repeat } from '@/lib/recurrence';
import { defaultDue, formatDue } from '@/lib/task-format';
import { scheduleTask } from '@/lib/task-logic';
import { useTasks } from '@/lib/tasks-context';
import { limits, radius, spacing, useColors } from '@/lib/theme';
import { useListUnderneath } from '@/lib/use-list-underneath';

const MAX_BODY = 2000;

export default function TaskEditorScreen() {
  // `title` and `due` (ms): a new one's starting values, e.g. from the widget's quick-add window
  const { id, title, due } = useLocalSearchParams<{ id: string; title?: string; due?: string }>();
  const { loaded } = useTasks();
  const colors = useColors();
  useListUnderneath();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const initialDue = due && Number.isFinite(Number(due)) ? Number(due) : undefined;
  return <TaskEditor key={id} id={id} initialTitle={title} initialDue={initialDue} />;
}

const newRepeat = (due: number): Repeat =>
  normalizeRepeat({ every: 1, unit: 'week', weekdays: [], start: startOfDay(due), end: { kind: 'never' } });

function TaskEditor({ id, initialTitle, initialDue }: { id: string; initialTitle?: string; initialDue?: number }) {
  const { tasks, now, createTask, editTask, removeTask } = useTasks();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const isNew = id === 'new';
  // The task as it was when the editor opened; edits are compared against this
  const [existing] = useState(() => (isNew ? undefined : tasks.find((task) => task.id === id)));

  const savedDue = existing ? existing.due : (initialDue ?? null);
  const [title, setTitle] = useState(existing?.title ?? initialTitle ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [hasDate, setHasDate] = useState(savedDue !== null);
  // Kept while the switches are off, so turning them back on brings the values back
  const [due, setDue] = useState(() => savedDue ?? defaultDue());
  const [repeatOn, setRepeatOn] = useState(existing?.repeat != null);
  const [repeat, setRepeat] = useState<Repeat>(() => existing?.repeat ?? newRepeat(savedDue ?? defaultDue()));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  const repeating = hasDate && repeatOn;
  const input = { due: hasDate ? due : null, repeat: repeating ? repeat : null };
  const schedule = useMemo(
    () => (repeating ? scheduleTask({ due, repeat }, now, existing) : null),
    [repeating, due, repeat, now, existing],
  );
  const repeatError = !repeating
    ? undefined
    : repeat.end.kind === 'on' && repeat.end.date < repeat.start
      ? t('repeatEndBeforeStart')
      : !schedule
        ? t('repeatOver')
        : undefined;
  const repeatSummary =
    schedule?.due != null ? `${t('repeatNext', { date: formatDue(schedule.due, now) })}. ${t('repeatHint')}` : undefined;

  const dirty =
    title !== (existing?.title ?? initialTitle ?? '') ||
    body !== (existing?.body ?? '') ||
    hasDate !== (savedDue !== null) ||
    (hasDate && due !== savedDue) ||
    repeating !== (existing?.repeat != null) ||
    (repeating && !sameRepeat(repeat, existing?.repeat ?? null));
  const canSave = title.trim().length > 0 && !busy && !repeatError;

  // Leaving with unsaved changes asks first; see the other editors
  const [discarding, setDiscarding] = useState(false);
  usePreventRemove(dirty && !done && !discarding, ({ repeat: replay }) => {
    Alert.alert(t('discardTitle'), t('discardTaskMessage'), [
      { text: t('keepEditing'), style: 'cancel' },
      {
        text: t('discard'),
        style: 'destructive',
        onPress: () => {
          setDiscarding(true);
          replay();
        },
      },
    ]);
  });

  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const toggleDate = (value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setHasDate(value);
    // No date, no repeat: turning the date back on doesn't quietly bring the rule back
    if (!value) setRepeatOn(false);
  };

  const toggleRepeat = (value: boolean) => {
    setRepeatOn(value);
    if (!value) return;
    // A rule needs a time to follow; a new one starts on the day the task is due
    setHasDate(true);
    if (!existing?.repeat) setRepeat((current) => normalizeRepeat({ ...current, start: startOfDay(due) }));
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(t('taskTitleRequired'));
      return;
    }
    if (repeatError) return;
    setBusy(true);
    try {
      const value = { title, body, ...input };
      if (isNew) await createTask(value);
      else if (existing) await editTask(existing.id, value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch (error) {
      console.error(error);
      Alert.alert(t('taskSaveFailed'));
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(t('deleteTaskTitle'), existing.repeat ? t('deleteTaskSeriesMessage') : undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeTask(existing.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setDone(true);
          } catch {
            Alert.alert(t('taskDeleteFailed'));
            setBusy(false);
          }
        },
      },
    ]);
  };

  const topBar = (
    <ModalHeader
      title={isNew ? t('newTask') : t('editTask')}
      onCancel={() => router.back()}
      onSave={isNew || existing ? save : undefined}
      canSave={canSave}
    />
  );

  // Opened from the widget for a task that was deleted in the meantime
  if (!isNew && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>{t('taskNotFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
    >
      {topBar}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('titlePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.titleInput, { color: colors.text }]}
            maxLength={limits.title}
            autoFocus={isNew && !initialTitle}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => bodyRef.current?.focus()}
            accessibilityLabel={t('titlePlaceholder')}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TextInput
            ref={bodyRef}
            value={body}
            onChangeText={setBody}
            placeholder={t('bodyPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.bodyInput, { color: colors.text }]}
            maxLength={MAX_BODY}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('bodyPlaceholder')}
          />
        </View>

        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Icon name="calendar" size={18} color={hasDate ? colors.accent : colors.textTertiary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('dateAndTime')}</Text>
              <Switch
                value={hasDate}
                onValueChange={toggleDate}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accessibilityLabel={t('dateAndTime')}
              />
            </View>
            {hasDate ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {/* A repeating task takes its days from the rule below, and only its time from here */}
                <DateTimeField
                  label={repeating ? t('time') : t('date')}
                  mode={repeating ? 'time' : 'datetime'}
                  value={due}
                  onChange={setDue}
                />
              </>
            ) : null}
          </View>
          {hasDate ? null : (
            <View style={styles.hint}>
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>{t('noDateHint')}</Text>
            </View>
          )}
        </View>

        <RepeatSettings
          enabled={repeating}
          onEnabledChange={toggleRepeat}
          repeat={repeat}
          onChange={setRepeat}
          error={repeatError}
          summary={repeatSummary}
        />

        {existing ? (
          <Pressable
            onPress={confirmDelete}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
            ]}
          >
            <Icon name="delete" size={18} color={colors.danger} />
            <Text style={[styles.deleteText, { color: colors.danger }]}>{t('deleteTask')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  bodyInput: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 96,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.xs },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },
  deleteText: { fontSize: 16, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  missingText: { fontSize: 16, textAlign: 'center' },
});
