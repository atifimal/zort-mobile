import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ModalHeader } from '@/components/ModalHeader';
import { t } from '@/lib/i18n';
import { useMemos } from '@/lib/memos-context';
import { limits, radius, spacing, useColors } from '@/lib/theme';

// Unlike Pin Note, nothing here has to fit in a notification
const MAX_BODY = 10000;

export default function MemoEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loaded } = useMemos();
  const colors = useColors();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return <MemoEditor key={id} id={id} />;
}

function MemoEditor({ id }: { id: string }) {
  const { memos, createMemo, editMemo, removeMemo } = useMemos();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : memos.find((memo) => memo.id === id)));

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [busy, setBusy] = useState(false);
  // Set once saved or deleted: leaving no longer asks to discard, and the screen closes
  const [done, setDone] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  const dirty = title !== (existing?.title ?? '') || body !== (existing?.body ?? '');
  const canSave = title.trim().length > 0 && !busy;

  // Leaving with unsaved changes asks first. "Discard" turns the guard off and replays the
  // blocked action with repeat(): re-dispatching it would just be blocked again.
  const [discarding, setDiscarding] = useState(false);
  usePreventRemove(dirty && !done && !discarding, ({ repeat }) => {
    Alert.alert(t('discardTitle'), t('discardMessage'), [
      { text: t('keepEditing'), style: 'cancel' },
      {
        text: t('discard'),
        style: 'destructive',
        onPress: () => {
          setDiscarding(true);
          repeat();
        },
      },
    ]);
  });

  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(t('titleRequired'));
      return;
    }
    setBusy(true);
    try {
      if (isNew) await createMemo({ title, body });
      else if (existing) await editMemo(existing.id, { title, body });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch (error) {
      console.error(error);
      Alert.alert(t('saveFailed'));
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(t('deleteMemoTitle'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeMemo(existing.id);
            setDone(true);
          } catch {
            Alert.alert(t('deleteFailed'));
            setBusy(false);
          }
        },
      },
    ]);
  };

  const topBar = (
    <ModalHeader
      title={isNew ? t('newNote') : t('editNote')}
      onCancel={() => router.back()}
      onSave={isNew || existing ? save : undefined}
      canSave={canSave}
    />
  );

  // Deleted while the editor was on its way (e.g. from another screen)
  if (!isNew && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>{t('noteNotFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    // iOS moves the content above the keyboard through the ScrollView's insets; Android needs
    // the padding because the app is drawn edge to edge and the window is not resized.
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
            autoFocus={isNew}
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
          {body.length > MAX_BODY * 0.9 ? (
            <Text style={[styles.counter, { color: colors.textTertiary }]}>
              {body.length}/{MAX_BODY}
            </Text>
          ) : null}
        </View>

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
            <Text style={[styles.deleteText, { color: colors.danger }]}>{t('deleteNote')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
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
    minHeight: 240,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  counter: { fontSize: 12, textAlign: 'right', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
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
