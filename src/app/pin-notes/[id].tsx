import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation, usePreventRemove, useRoute } from 'expo-router';
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
import { PinSettings } from '@/components/PinSettings';
import type { PinWindow } from '@/lib/db';
import { t } from '@/lib/i18n';
import { useNotes } from '@/lib/notes-context';
import { defaultWindow } from '@/lib/pin-status';
import { limits, radius, spacing, useColors } from '@/lib/theme';

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loaded } = useNotes();
  const colors = useColors();
  useListUnderneath();
  // Opened from a notification on a cold start, the notes may still be loading
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return <NoteEditor key={id} id={id} />;
}

/**
 * Opened from a notification, the editor can be the only screen in Pin Note's stack (the
 * layout's anchor isn't applied when the app starts from a link), so Back would skip the
 * note list. This puts the list underneath, keeping the editor as it is.
 */
function useListUnderneath() {
  const navigation = useNavigation();
  const route = useRoute();
  useEffect(() => {
    const state = navigation.getState();
    if (!state || state.routes.length !== 1 || state.routes[0]?.key !== route.key) return;
    navigation.reset({
      index: 1,
      routes: [{ name: 'index' }, { name: route.name, key: route.key, params: route.params }],
    } as Parameters<typeof navigation.reset>[0]);
    // Only when the editor first opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function NoteEditor({ id }: { id: string }) {
  const { notes, now, createNote, editNote, removeNote } = useNotes();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const isNew = id === 'new';
  // The note as it was when the editor opened; edits are compared against this
  const [existing] = useState(() => (isNew ? undefined : notes.find((note) => note.id === id)));

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  // New notes are pinned, always; the window keeps its times while "Always" is ticked
  const [pinned, setPinned] = useState(existing?.pinned ?? true);
  const [always, setAlways] = useState(!existing?.window);
  const [pinWindow, setPinWindow] = useState<PinWindow>(() => existing?.window ?? defaultWindow(Date.now()));
  const [busy, setBusy] = useState(false);
  // Set once saved or deleted: leaving no longer asks to discard, and the screen closes
  const [done, setDone] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  const savedWindow = existing?.window ?? null;
  const dirty =
    title !== (existing?.title ?? '') ||
    body !== (existing?.body ?? '') ||
    pinned !== (existing?.pinned ?? true) ||
    always !== !savedWindow ||
    (!always && (pinWindow.start !== savedWindow?.start || pinWindow.end !== savedWindow?.end));

  // Only a window that's in use can be wrong; an unpinned note keeps whatever it has
  const windowError =
    !pinned || always
      ? undefined
      : pinWindow.end <= pinWindow.start
        ? t('windowInvalid')
        : pinWindow.end <= now
          ? t('windowEnded')
          : undefined;
  const canSave = title.trim().length > 0 && !busy && !windowError;

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
    if (windowError) return;
    const input = { title, body, pinned, window: always ? null : pinWindow };
    setBusy(true);
    try {
      if (isNew) await createNote(input);
      else if (existing) await editNote(existing.id, input);
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
    Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeNote(existing.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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

  // Opened from a notification of a note that was deleted in the meantime
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
            maxLength={limits.body}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('bodyPlaceholder')}
          />
          {body.length > limits.body * 0.8 ? (
            <Text style={[styles.counter, { color: colors.textTertiary }]}>
              {body.length}/{limits.body}
            </Text>
          ) : null}
        </View>

        <PinSettings
          pinned={pinned}
          onPinnedChange={setPinned}
          always={always}
          onAlwaysChange={setAlways}
          window={pinWindow}
          onWindowChange={setPinWindow}
          error={windowError}
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
    minHeight: 160,
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
