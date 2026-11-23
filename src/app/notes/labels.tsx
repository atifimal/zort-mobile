import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ModalHeader } from '@/components/ModalHeader';
import { t } from '@/lib/i18n';
import { LABEL_COLORS, labelColorName, useLabelShades, type LabelColor } from '@/lib/label-colors';
import { useMemos } from '@/lib/memos-context';
import type { MemoLabel } from '@/lib/memos-db';
import { radius, spacing, useColors } from '@/lib/theme';

const MAX_NAME = 30;

/** The first color no label has yet, so new labels tell apart without picking one. */
const unusedColor = (labels: MemoLabel[]): LabelColor =>
  LABEL_COLORS.find((color) => !labels.some((label) => label.color === color)) ?? 'blue';

/** The Notes page's labels: add one, rename it, recolor it, delete it. */
export default function LabelsScreen() {
  const { labels, loaded, createLabel, editLabel, removeLabel } = useMemos();
  const colors = useColors();
  const shades = useLabelShades();
  const insets = useSafeAreaInsets();

  // The label in the form below; null: the form adds a new one
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === null ? undefined : labels.find((label) => label.id === editingId);
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>(() => unusedColor(labels));
  const [busy, setBusy] = useState(false);

  const resetForm = (next: MemoLabel[] = labels) => {
    setEditingId(null);
    setName('');
    setColor(unusedColor(next));
  };

  const startEditing = (label: MemoLabel) => {
    setEditingId(label.id);
    setName(label.name);
    setColor(label.color);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t('labelNameRequired'));
      return;
    }
    const lower = trimmed.toLocaleLowerCase();
    if (labels.some((label) => label.id !== editing?.id && label.name.toLocaleLowerCase() === lower)) {
      Alert.alert(t('labelNameTaken'));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await editLabel(editing.id, { name: trimmed, color });
        resetForm();
      } else {
        const label = await createLabel({ name: trimmed, color });
        resetForm([...labels, label]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.error(error);
      Alert.alert(t('labelSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (label: MemoLabel) => {
    Alert.alert(t('deleteLabelTitle'), `“${label.name}”\n${t('deleteLabelMessage')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeLabel(label.id);
            resetForm(labels.filter((item) => item.id !== label.id));
          } catch {
            Alert.alert(t('labelDeleteFailed'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
    >
      <ModalHeader title={t('labels')} onCancel={() => router.back()} cancelLabel={t('done')} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {labels.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('labelsEmpty')}</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {labels.map((label, index) => (
              <Pressable
                key={label.id}
                onPress={() => startEditing(label)}
                accessibilityRole="button"
                accessibilityLabel={`${label.name}, ${t(labelColorName[label.color])}`}
                accessibilityHint={t('editLabel')}
                accessibilityState={{ selected: label.id === editingId }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  {
                    backgroundColor: pressed
                      ? colors.surfacePressed
                      : label.id === editingId
                        ? shades[label.color].surface
                        : 'transparent',
                  },
                ]}
              >
                <View style={[styles.rowDot, { backgroundColor: shades[label.color].strong }]} />
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {label.name}
                </Text>
                <Icon name="edit" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {editing ? t('editLabel') : t('newLabel')}
          </Text>
          <View style={[styles.card, styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('labelNamePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              maxLength={MAX_NAME}
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel={t('labelNamePlaceholder')}
            />
            <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={t('labelColor')}>
              {LABEL_COLORS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setColor(option)}
                  accessibilityRole="radio"
                  accessibilityLabel={t(labelColorName[option])}
                  accessibilityState={{ checked: color === option }}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.swatch,
                    {
                      backgroundColor: shades[option].strong,
                      borderColor: color === option ? colors.text : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {color === option ? <Icon name="check" size={18} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
            <View style={styles.buttons}>
              {editing ? (
                <>
                  <FormButton
                    label={t('delete')}
                    color={colors.danger}
                    onPress={() => confirmDelete(editing)}
                    disabled={busy}
                  />
                  <View style={{ flex: 1 }} />
                  <FormButton label={t('cancel')} color={colors.textSecondary} onPress={() => resetForm()} />
                </>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Pressable
                onPress={save}
                disabled={busy || !name.trim()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: !name.trim()
                      ? colors.surfacePressed
                      : pressed
                        ? colors.accentPressed
                        : colors.accent,
                  },
                ]}
              >
                <Text style={[styles.saveText, { color: name.trim() ? colors.onAccent : colors.textTertiary }]}>
                  {editing ? t('save') : t('addLabel')}
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('labelsHint')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
      {({ pressed }) => (
        <Text style={[styles.formButton, { color, opacity: pressed || disabled ? 0.6 : 1 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  rowDot: { width: 14, height: 14, borderRadius: 7 },
  rowName: { flex: 1, fontSize: 16, fontWeight: '500' },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginLeft: spacing.xs },
  form: { padding: spacing.lg, gap: spacing.lg },
  nameInput: {
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  formButton: { fontSize: 16, fontWeight: '600', paddingVertical: spacing.sm },
  saveButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md - 2, borderRadius: radius.pill },
  saveText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, marginHorizontal: spacing.xs },
});
