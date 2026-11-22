import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { addDays, MAX_COUNT, MAX_EVERY, normalizeRepeat, startOfDay, type Repeat, type RepeatEnd, type RepeatUnit } from '@/lib/recurrence';
import { WEEK_ORDER, weekdayName } from '@/lib/task-format';
import { radius, spacing, useColors } from '@/lib/theme';

import { DateTimeField } from './DateTimeField';
import { Icon } from './Icon';
import { Stepper } from './Stepper';

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** The rule being edited; kept while repeat is off, so turning it back on restores it. */
  repeat: Repeat;
  onChange: (repeat: Repeat) => void;
  /** Shown under the card: what's wrong with the rule, or when the task is next due. */
  error?: string;
  summary?: string;
};

const UNITS: readonly RepeatUnit[] = ['day', 'week', 'month', 'year'];

const unitLabel = (unit: RepeatUnit, every: number) => {
  const one = every === 1;
  switch (unit) {
    case 'day':
      return one ? t('unitDay') : t('unitDays');
    case 'week':
      return one ? t('unitWeek') : t('unitWeeks');
    case 'month':
      return one ? t('unitMonth') : t('unitMonths');
    case 'year':
      return one ? t('unitYear') : t('unitYears');
  }
};

/** The editor's repeat section: every n days/weeks/months/years, on which days, from when, until when. */
export function RepeatSettings({ enabled, onEnabledChange, repeat, onChange, error, summary }: Props) {
  const colors = useColors();
  // The other end choices keep their values while one is picked, as they were last set
  const lastDate = useRef(repeat.end.kind === 'on' ? repeat.end.date : null);
  const lastCount = useRef(repeat.end.kind === 'count' ? repeat.end.count : 10);

  const update = (patch: Partial<Repeat>) => onChange(normalizeRepeat({ ...repeat, ...patch }));

  const setUnit = (unit: RepeatUnit) => {
    if (unit === repeat.unit) return;
    Haptics.selectionAsync().catch(() => {});
    // A weekly rule starts on the start's own weekday; normalizeRepeat fills that in
    update({ unit, weekdays: [] });
  };

  const toggleWeekday = (day: number) => {
    const selected = repeat.weekdays.includes(day);
    // At least one day stays selected
    if (selected && repeat.weekdays.length === 1) return;
    Haptics.selectionAsync().catch(() => {});
    update({ weekdays: selected ? repeat.weekdays.filter((item) => item !== day) : [...repeat.weekdays, day] });
  };

  const setEnd = (kind: RepeatEnd['kind']) => {
    if (kind === repeat.end.kind) return;
    Haptics.selectionAsync().catch(() => {});
    if (repeat.end.kind === 'on') lastDate.current = repeat.end.date;
    if (repeat.end.kind === 'count') lastCount.current = repeat.end.count;
    const end: RepeatEnd =
      kind === 'on'
        ? { kind, date: lastDate.current ?? addDays(repeat.start, 30) }
        : kind === 'count'
          ? { kind, count: lastCount.current }
          : { kind: 'never' };
    update({ end });
  };

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Icon name="repeat" size={18} color={enabled ? colors.accent : colors.textTertiary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('repeat')}</Text>
          <Switch
            value={enabled}
            onValueChange={(value) => {
              Haptics.selectionAsync().catch(() => {});
              onEnabledChange(value);
            }}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            accessibilityLabel={t('repeat')}
          />
        </View>

        {enabled ? (
          <>
            <Divider />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('repeatEvery')}</Text>
              <Stepper
                value={repeat.every}
                onChange={(every) => update({ every })}
                max={MAX_EVERY}
                label={`${t('repeatEvery')} ${repeat.every} ${unitLabel(repeat.unit, repeat.every)}`}
              />
            </View>
            <View style={styles.block}>
              <View style={[styles.segments, { backgroundColor: colors.background }]} accessibilityRole="radiogroup">
                {UNITS.map((unit) => {
                  const selected = unit === repeat.unit;
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => setUnit(unit)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.segment,
                        selected && [styles.segmentSelected, { backgroundColor: colors.surface, shadowColor: '#000' }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: selected ? colors.text : colors.textSecondary },
                          selected && styles.segmentTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {unitLabel(unit, repeat.every)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {repeat.unit === 'week' ? (
              <>
                <Divider />
                <View style={styles.block}>
                  <Text style={[styles.blockLabel, { color: colors.textSecondary }]}>{t('repeatOnDays')}</Text>
                  <View style={styles.weekdays}>
                    {WEEK_ORDER.map((day) => {
                      const selected = repeat.weekdays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          onPress={() => toggleWeekday(day)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={weekdayName(day)}
                          style={({ pressed }) => [
                            styles.weekday,
                            selected
                              ? { backgroundColor: colors.accent, borderColor: colors.accent }
                              : {
                                  backgroundColor: pressed ? colors.surfacePressed : colors.background,
                                  borderColor: colors.border,
                                },
                          ]}
                        >
                          <Text
                            style={[styles.weekdayText, { color: selected ? colors.onAccent : colors.text }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {weekdayName(day)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}

            <Divider />
            <DateTimeField
              label={t('starts')}
              mode="date"
              value={repeat.start}
              onChange={(start) => update({ start: startOfDay(start) })}
            />

            <Divider />
            <View style={styles.block}>
              <Text style={[styles.blockLabel, { color: colors.textSecondary }]}>{t('ends')}</Text>
            </View>
            <Radio label={t('endNever')} selected={repeat.end.kind === 'never'} onPress={() => setEnd('never')} />
            <Radio label={t('endOn')} selected={repeat.end.kind === 'on'} onPress={() => setEnd('on')} />
            {repeat.end.kind === 'on' ? (
              <View style={styles.indent}>
                <DateTimeField
                  label={t('date')}
                  mode="date"
                  value={repeat.end.date}
                  minimum={repeat.start}
                  onChange={(date) => update({ end: { kind: 'on', date: startOfDay(date) } })}
                />
              </View>
            ) : null}
            <Radio label={t('endAfter')} selected={repeat.end.kind === 'count'} onPress={() => setEnd('count')} />
            {repeat.end.kind === 'count' ? (
              <View style={[styles.row, styles.indent]}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {repeat.end.count === 1 ? t('timesOne') : t('timesMany', { n: repeat.end.count })}
                </Text>
                <Stepper
                  value={repeat.end.count}
                  onChange={(count) => update({ end: { kind: 'count', count } })}
                  max={MAX_COUNT}
                  label={t('endAfter')}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {enabled && (error || summary) ? (
        <View style={styles.hint}>
          {error ? null : <Icon name="repeat" size={14} color={colors.textTertiary} />}
          <Text
            style={[styles.hintText, { color: error ? colors.danger : colors.textTertiary }]}
            accessibilityLiveRegion="polite"
          >
            {error ?? summary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function Radio({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, styles.radioRow, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.textTertiary }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  radioRow: { minHeight: 46 },
  rowLabel: { flex: 1, fontSize: 16 },
  block: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: spacing.sm },
  blockLabel: { fontSize: 13, fontWeight: '600', paddingTop: spacing.sm },
  indent: { marginLeft: spacing.xl + spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  segments: { flexDirection: 'row', padding: 3, borderRadius: radius.md },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 3 },
  segmentSelected: { shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segmentText: { fontSize: 14, fontWeight: '500' },
  segmentTextSelected: { fontWeight: '700' },
  weekdays: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  weekday: {
    flex: 1,
    maxWidth: 46,
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  weekdayText: { fontSize: 12, fontWeight: '700' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.xs },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
