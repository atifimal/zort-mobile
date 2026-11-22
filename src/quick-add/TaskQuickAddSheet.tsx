import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  type TextInputInstance,
} from 'react-native';

import { closeQuickAdd } from '@modules/quick-add';

import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { addDays, atTime, minutesOf, startOfDay } from '@/lib/recurrence';
import { defaultDue, formatDay, formatTime } from '@/lib/task-format';
import { useTasks } from '@/lib/tasks-context';
import { limits, radius, spacing, useColors } from '@/lib/theme';

import { frameStyles, QuickAddFrame, useFocusOnOpen, useSheet } from './QuickAddFrame';

type DayChoice = 'none' | 'today' | 'tomorrow' | 'other';

/**
 * The Tasks widget's + : a task's title, an optional description, and when it's due (no date,
 * today, tomorrow or a picked day, at a time). Repeat rules are set in the app ("Open in app"
 * carries what was typed there).
 */
export function TaskQuickAddSheet() {
  return <QuickAddFrame title={t('newTask')}><TaskForm /></QuickAddFrame>;
}

function TaskForm() {
  const controls = useSheet();
  const colors = useColors();
  const { loaded, createTask } = useTasks();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [choice, setChoice] = useState<DayChoice>('none');
  const [otherDay, setOtherDay] = useState(() => addDays(startOfDay(Date.now()), 2));
  const [minutes, setMinutes] = useState(() => minutesOf(defaultDue()));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<TextInputInstance>(null);
  const bodyRef = useRef<TextInputInstance>(null);
  useFocusOnOpen(() => titleRef.current?.focus());

  // The window lives for a minute at most: today is today for as long as it's open
  const [today] = useState(() => startOfDay(Date.now()));
  const day = choice === 'today' ? today : choice === 'tomorrow' ? addDays(today, 1) : choice === 'other' ? otherDay : null;
  const due = day === null ? null : atTime(day, minutes);
  const trimmed = title.trim();
  const error = checked && !trimmed ? t('taskTitleRequired') : undefined;
  const canAdd = loaded && !busy && trimmed.length > 0;

  const choose = (next: DayChoice) => {
    Haptics.selectionAsync().catch(() => {});
    if (next !== 'other') {
      setChoice(next);
      return;
    }
    DateTimePickerAndroid.open({
      value: new Date(otherDay),
      mode: 'date',
      minimumDate: new Date(today),
      onValueChange: (_, picked) => {
        setOtherDay(startOfDay(picked.getTime()));
        setChoice('other');
      },
    });
  };

  const pickTime = () => {
    Haptics.selectionAsync().catch(() => {});
    DateTimePickerAndroid.open({
      value: new Date(atTime(day ?? today, minutes)),
      mode: 'time',
      onValueChange: (_, picked) => setMinutes(minutesOf(picked.getTime())),
    });
  };

  const add = async () => {
    setChecked(true);
    if (!canAdd) return;
    setBusy(true);
    try {
      // A task with a time reminds at that time; the app can change or turn it off
      await createTask({ title: trimmed, body, due, repeat: null, reminder: due === null ? null : 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      ToastAndroid.show(t('quickAddedTask'), ToastAndroid.SHORT);
      controls.dismiss();
    } catch (cause) {
      console.error(cause);
      Alert.alert(t('taskSaveFailed'));
      setBusy(false);
    }
  };

  /** The full editor, with what's been typed and picked, for a repeat rule and the rest. */
  const openInApp = () => {
    if (!controls.leave()) return;
    const params = new URLSearchParams();
    if (trimmed) params.set('title', trimmed);
    if (due !== null) params.set('due', String(due));
    const query = params.toString();
    const target = query ? `zort://tasks/new?${query}` : 'zort://tasks';
    Linking.openURL(target)
      .catch((cause) => console.error('Could not open the app', cause))
      .finally(closeQuickAdd);
  };

  const chips: { key: DayChoice; label: string; icon?: IconName }[] = [
    { key: 'none', label: t('noDate') },
    { key: 'today', label: t('today') },
    { key: 'tomorrow', label: t('tomorrow') },
    { key: 'other', label: choice === 'other' ? formatDay(otherDay) : t('pickDate'), icon: 'calendar' },
  ];

  return (
    <>
      <View style={[styles.fields, { backgroundColor: colors.background, borderColor: error ? colors.danger : colors.border }]}>
        <TextInput
          ref={titleRef}
          value={title}
          onChangeText={setTitle}
          placeholder={t('quickTaskPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          maxLength={limits.title}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => bodyRef.current?.focus()}
          accessibilityLabel={t('quickTaskPlaceholder')}
          style={[styles.titleInput, { color: colors.text }]}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TextInput
          ref={bodyRef}
          value={body}
          onChangeText={setBody}
          placeholder={t('bodyPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          maxLength={2000}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={add}
          accessibilityLabel={t('bodyPlaceholder')}
          style={[styles.bodyInput, { color: colors.text }]}
        />
      </View>

      <View style={styles.chips} accessibilityRole="radiogroup">
        {chips.map((chip) => {
          const selected = chip.key === choice;
          return (
            <Pressable
              key={chip.key}
              onPress={() => choose(chip.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: pressed ? colors.surfacePressed : colors.background, borderColor: colors.border },
              ]}
            >
              {chip.icon ? (
                <Icon name={chip.icon} size={15} color={selected ? colors.onAccent : colors.textSecondary} />
              ) : null}
              <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]} numberOfLines={1}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {day !== null ? (
        <Pressable
          onPress={pickTime}
          accessibilityRole="button"
          accessibilityLabel={`${t('time')}, ${formatTime(atTime(day, minutes))}`}
          style={({ pressed }) => [
            styles.timeRow,
            { backgroundColor: pressed ? colors.surfacePressed : colors.background, borderColor: colors.border },
          ]}
        >
          <Icon name="clock" size={18} color={colors.accent} />
          <Text style={[styles.timeLabel, { color: colors.text }]}>{t('time')}</Text>
          <Text style={[styles.timeValue, { color: colors.accent }]}>{formatTime(atTime(day, minutes))}</Text>
        </Pressable>
      ) : null}

      <Text style={[frameStyles.hint, styles.hint, { color: error ? colors.danger : colors.textTertiary }]} accessibilityLiveRegion="polite">
        {error ?? t('quickTaskHint')}
      </Text>

      <View style={frameStyles.actions}>
        <Pressable
          onPress={add}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd, busy }}
          style={({ pressed }) => [
            frameStyles.action,
            { backgroundColor: pressed ? colors.accentPressed : colors.accent, opacity: canAdd ? 1 : 0.45 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              <Icon name="add" size={20} color={colors.onAccent} />
              <Text style={[frameStyles.actionText, { color: colors.onAccent }]} numberOfLines={1}>
                {t('quickAdd')}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={openInApp}
          disabled={busy}
          accessibilityRole="link"
          style={({ pressed }) => [
            frameStyles.action,
            frameStyles.secondaryAction,
            { backgroundColor: pressed ? colors.surfacePressed : colors.background, borderColor: colors.border },
          ]}
        >
          <Icon name="openApp" size={18} color={colors.accent} />
          <Text style={[frameStyles.actionText, { color: colors.text }]} numberOfLines={1}>
            {t('openInApp')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fields: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginTop: spacing.xs },
  titleInput: { fontSize: 17, fontWeight: '600', height: 52, paddingHorizontal: spacing.lg },
  bodyInput: { fontSize: 15, height: 46, paddingHorizontal: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 38,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeLabel: { flex: 1, fontSize: 16 },
  timeValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hint: { marginTop: 0 },
});
