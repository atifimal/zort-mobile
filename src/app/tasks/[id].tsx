import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
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

import { canScheduleExactAlarms, openExactAlarmSettings } from '@modules/quick-add';
import { getPermissionStatus } from '@modules/pinned-notifications';

import { ActionSheet } from '@/components/ActionSheet';
import { DateTimeField } from '@/components/DateTimeField';
import { Icon } from '@/components/Icon';
import { ModalHeader } from '@/components/ModalHeader';
import { RepeatSettings } from '@/components/RepeatSettings';
import { t } from '@/lib/i18n';
import { normalizeRepeat, sameRepeat, startOfDay, type Repeat } from '@/lib/recurrence';
import { defaultDue, describeReminder, formatDue } from '@/lib/task-format';
import { REMINDER_CHOICES, scheduleTask } from '@/lib/task-logic';
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
  // New tasks remind at their due time; tasks from before reminders existed have none
  const savedReminder = existing ? existing.reminder : 0;
  const [reminder, setReminder] = useState<number | null>(savedReminder ?? (existing ? null : 0));
  const [choosingReminder, setChoosingReminder] = useState(false);
  const reminderAccess = useReminderAccess(hasDate && reminder !== null);
  const [repeatOn, setRepeatOn] = useState(existing?.repeat != null);
  const [repeat, setRepeat] = useState<Repeat>(() => existing?.repeat ?? newRepeat(savedDue ?? defaultDue()));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  const repeating = hasDate && repeatOn;
  const input = { due: hasDate ? due : null, repeat: repeating ? repeat : null, reminder: hasDate ? reminder : null };
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
    (hasDate && reminder !== savedReminder) ||
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
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => setChoosingReminder(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('reminder')}, ${describeReminder(reminder)}`}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
                >
                  <Icon name="bell" size={18} color={reminder !== null ? colors.accent : colors.textTertiary} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{t('reminder')}</Text>
                  <Text style={[styles.rowValue, { color: reminder !== null ? colors.accent : colors.textSecondary }]}>
                    {describeReminder(reminder)}
                  </Text>
                  <Icon name="chevron" size={16} color={colors.textTertiary} />
                </Pressable>
              </>
            ) : null}
          </View>
          {!hasDate ? (
            <View style={styles.hint}>
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>{t('noDateHint')}</Text>
            </View>
          ) : reminderAccess === 'notifications' ? (
            <AccessHint text={t('reminderNotificationsOff')} action={t('permissionAction')} onPress={openNotificationSettings} />
          ) : reminderAccess === 'exact' ? (
            <AccessHint text={t('reminderExactHint')} action={t('reminderAllow')} onPress={openExactAlarmSettings} />
          ) : null}
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

      <ActionSheet
        visible={choosingReminder}
        title={t('reminderTitle')}
        subtitle={repeating ? t('reminderRepeatHint') : undefined}
        actions={[null, ...REMINDER_CHOICES].map((choice) => ({
          key: String(choice),
          label: describeReminder(choice),
          icon: choice === reminder ? 'check' : choice === null ? 'notificationsOff' : 'bell',
          onPress: () => {
            Haptics.selectionAsync().catch(() => {});
            setReminder(choice);
          },
        }))}
        onClose={() => setChoosingReminder(false)}
      />
    </KeyboardAvoidingView>
  );
}

type ReminderAccess = 'ok' | 'notifications' | 'exact';

/**
 * Whether a reminder can reach the user on time: notifications allowed, and (Android 14+) exact
 * alarms allowed. Checked again when the app comes back, e.g. from the settings screen.
 */
function useReminderAccess(wanted: boolean): ReminderAccess {
  const [access, setAccess] = useState<ReminderAccess>('ok');
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const check = async () => {
      const notifications = await getPermissionStatus().catch(() => 'granted');
      const exact = await canScheduleExactAlarms().catch(() => true);
      if (!cancelled) setAccess(notifications !== 'granted' ? 'notifications' : !exact ? 'exact' : 'ok');
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [wanted]);
  return wanted ? access : 'ok';
}

function openNotificationSettings() {
  Linking.openSettings().catch(() => {});
}

function AccessHint({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.access, { backgroundColor: colors.warningSurface }]} accessibilityLiveRegion="polite">
      <Icon name="notificationsOff" size={16} color={colors.warningText} />
      <Text style={[styles.accessText, { color: colors.warningText }]}>{text}</Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={[styles.accessAction, { color: colors.warningText }]}>{action}</Text>
      </Pressable>
    </View>
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
  rowValue: { fontSize: 15, fontWeight: '500' },
  access: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  accessText: { flex: 1, fontSize: 13, lineHeight: 18 },
  accessAction: { fontSize: 14, fontWeight: '700' },
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
