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
import { t } from '@/lib/i18n';
import { useNotes } from '@/lib/notes-context';
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
  const { notes, createNote, editNote, removeNote } = useNotes();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const isNew = id === 'new';
  // The note as it was when the editor opened; edits are compared against this
  const [existing] = useState(() => (isNew ? undefined : notes.find((note) => note.id === id)));

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [busy, setBusy] = useState(false);
  // Set once saved or deleted: leaving no longer asks to discard, and the screen closes
  const [done, setDone] = useState(false);
  const bodyRef = useRef<TextInputInstance>(null);

  const dirty = title !== (existing?.title ?? '') || body !== (existing?.body ?? '');
  const canSave = title.trim().length > 0 && !busy;

  usePreventRemove(dirty && !done, ({ data }) => {
    Alert.alert(t('discardTitle'), t('discardMessage'), [
      { text: t('keepEditing'), style: 'cancel' },
      { text: t('discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
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
      if (isNew) await createNote({ title, body });
      else if (existing) await editNote(existing.id, { title, body });
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

  // Our own bar rather than the native header's headerLeft/headerRight: react-native-screens on
  // Android crashes ("child already has a parent") when those re-render while the modal closes.
  const topBar = (
    <View
      style={[
        styles.topBar,
        // The iOS sheet starts below the status bar; Android's modal covers the whole screen
        { paddingTop: Platform.OS === 'android' ? insets.top : 0, borderBottomColor: colors.border },
      ]}
    >
      <HeaderButton label={t('cancel')} onPress={() => router.back()} color={colors.accent} />
      <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
        {isNew ? t('newNote') : t('editNote')}
      </Text>
      {isNew || existing ? (
        <HeaderButton
          label={t('save')}
          onPress={save}
          disabled={!canSave}
          color={canSave ? colors.accent : colors.textTertiary}
          bold
        />
      ) : (
        <View />
      )}
    </View>
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

        <View style={styles.hint}>
          <Icon name="pin" size={14} color={colors.textTertiary} />
          <Text style={[styles.hintText, { color: colors.textTertiary }]}>{t('pinnedHint')}</Text>
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

function HeaderButton({
  label,
  onPress,
  color,
  disabled,
  bold,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  bold?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={12} accessibilityRole="button">
      {({ pressed }) => (
        <Text style={[styles.headerButton, { color, opacity: pressed ? 0.6 : 1 }, bold && styles.headerButtonBold]}>
          {label}
        </Text>
      )}
    </Pressable>
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
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.xs, marginTop: -spacing.sm },
  hintText: { fontSize: 13 },
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  headerButton: { fontSize: 17, paddingVertical: spacing.md },
  headerButtonBold: { fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  missingText: { fontSize: 16, textAlign: 'center' },
});
