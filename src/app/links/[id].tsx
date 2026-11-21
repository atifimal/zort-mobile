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
import { useLinks } from '@/lib/links-context';
import { radius, spacing, useColors } from '@/lib/theme';
import { normalizeUrl } from '@/lib/url';

const MAX_URL = 2048;
const MAX_TITLE = 100;

export default function LinkEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loaded } = useLinks();
  const colors = useColors();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return <LinkEditor key={id} id={id} />;
}

function LinkEditor({ id }: { id: string }) {
  const { links, createLink, editLink, removeLink } = useLinks();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : links.find((link) => link.id === id)));

  const [url, setUrl] = useState(existing?.url ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  // The address is checked once the user leaves the field or tries to save, not while typing
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const titleRef = useRef<TextInputInstance>(null);

  const normalized = normalizeUrl(url);
  const urlError = !checked ? undefined : !url.trim() ? t('urlRequired') : !normalized ? t('urlInvalid') : undefined;
  const dirty = url !== (existing?.url ?? '') || title !== (existing?.title ?? '');
  const canSave = url.trim().length > 0 && !busy;

  // Leaving with unsaved changes asks first. "Discard" turns the guard off and replays the
  // blocked action with repeat(): re-dispatching it would just be blocked again.
  const [discarding, setDiscarding] = useState(false);
  usePreventRemove(dirty && !done && !discarding, ({ repeat }) => {
    Alert.alert(t('discardTitle'), t('discardLinkMessage'), [
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
    setChecked(true);
    if (!normalized) return;
    setBusy(true);
    try {
      const input = { url: normalized, title };
      if (isNew) await createLink(input);
      else if (existing) await editLink(existing.id, input);
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
    Alert.alert(t('deleteLinkTitle'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeLink(existing.id);
            setDone(true);
          } catch {
            Alert.alert(t('deleteFailed'));
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
    >
      <ModalHeader
        title={isNew ? t('newLink') : t('editLink')}
        onCancel={() => router.back()}
        onSave={save}
        canSave={canSave}
      />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.section}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: urlError ? colors.danger : colors.border },
            ]}
          >
            <TextInput
              value={url}
              onChangeText={setUrl}
              onBlur={() => url.trim() && setChecked(true)}
              placeholder={t('urlPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.urlInput, { color: colors.text }]}
              maxLength={MAX_URL}
              autoFocus={isNew}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="url"
              keyboardType="url"
              textContentType="URL"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => titleRef.current?.focus()}
              accessibilityLabel={t('urlPlaceholder')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TextInput
              ref={titleRef}
              value={title}
              onChangeText={setTitle}
              placeholder={t('linkTitlePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.titleInput, { color: colors.text }]}
              maxLength={MAX_TITLE}
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel={t('linkTitlePlaceholder')}
            />
          </View>
          <Text
            style={[styles.hint, { color: urlError ? colors.danger : colors.textTertiary }]}
            accessibilityLiveRegion="polite"
          >
            {urlError ?? t('linkTitleHint')}
          </Text>
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
            <Text style={[styles.deleteText, { color: colors.danger }]}>{t('deleteLink')}</Text>
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
  urlInput: { fontSize: 17, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  titleInput: { fontSize: 17, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  hint: { fontSize: 13, lineHeight: 18, marginLeft: spacing.xs },
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
});
