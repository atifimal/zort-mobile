import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { language } from '@/lib/i18n';
import { formatDateTime } from '@/lib/pin-status';
import { spacing, useColors } from '@/lib/theme';

type Props = {
  label: string;
  /** ms since epoch */
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  disabled?: boolean;
};

const toMinute = (date: Date) => Math.floor(date.getTime() / 60_000) * 60_000;

/**
 * A labelled date-and-time row. iOS shows its compact picker in the row; Android shows the
 * value and opens the system date dialog, then the time dialog.
 */
export function DateTimeField({ label, value, onChange, minimum, disabled }: Props) {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const minimumDate = minimum === undefined ? undefined : new Date(minimum);

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.row, disabled && styles.disabled]}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <DateTimePicker
          value={new Date(value)}
          mode="datetime"
          display="compact"
          minimumDate={minimumDate}
          disabled={disabled}
          locale={language}
          accentColor={colors.accent}
          themeVariant={dark ? 'dark' : 'light'}
          onValueChange={(_, date) => onChange(toMinute(date))}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  const open = () => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      minimumDate,
      onValueChange: (_, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          onValueChange: (__, time) => onChange(toMinute(time)),
        });
      },
    });
  };

  const formatted = formatDateTime(value);
  return (
    <Pressable
      onPress={open}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatted}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.value, { backgroundColor: colors.background }]}>
        <Text style={[styles.valueText, { color: colors.accent }]}>{formatted}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  disabled: { opacity: 0.4 },
  label: { fontSize: 16 },
  value: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: 8 },
  valueText: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
