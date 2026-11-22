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

import { closeQuickAdd, type QuickAddType } from '@modules/quick-add';

import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { useLinks } from '@/lib/links-context';
import { useMemos } from '@/lib/memos-context';
import { useNotes } from '@/lib/notes-context';
import { limits, radius, spacing, useColors } from '@/lib/theme';
import { normalizeUrl } from '@/lib/url';

import { frameStyles, QuickAddFrame, useFocusOnOpen, useSheet } from './QuickAddFrame';

/** What this sheet adds; tasks have their own (TaskQuickAddSheet). */
export type QuickAddItemType = Exclude<QuickAddType, 'task'>;

const MAX_URL = 2048;

type TypeInfo = {
  label: string;
  icon: IconName;
  placeholder: string;
  hint: string;
  added: string;
  maxLength: number;
};

const typeInfo = (type: QuickAddItemType): TypeInfo => {
  switch (type) {
    case 'pin-note':
      return {
        label: t('quickTypePin'),
        icon: 'pin',
        placeholder: t('quickPinPlaceholder'),
        hint: t('pinNoteDescription'),
        added: t('quickAddedPin'),
        maxLength: limits.title,
      };
    case 'link':
      return {
        label: t('quickTypeLink'),
        icon: 'link',
        placeholder: t('urlPlaceholder'),
        hint: t('linksDescription'),
        added: t('quickAddedLink'),
        maxLength: MAX_URL,
      };
    case 'note':
      return {
        label: t('quickTypeNote'),
        icon: 'note',
        placeholder: t('quickNotePlaceholder'),
        hint: t('notesDescription'),
        added: t('quickAddedNote'),
        maxLength: limits.title,
      };
  }
};

const TYPES: readonly QuickAddItemType[] = ['pin-note', 'note', 'link'];

/**
 * The quick-add sheet: pick what to add, type the one thing it needs (a Pin Note's title, a
 * link's address, a note's title) and add it. The rest (a description, a time range, a link's
 * title) can be filled in later in the app.
 */
export function QuickAddSheet({ initialType }: { initialType: QuickAddItemType }) {
  return (
    <QuickAddFrame title={t('quickAddTitle')}>
      <QuickAddForm initialType={initialType} />
    </QuickAddFrame>
  );
}

function QuickAddForm({ initialType }: { initialType: QuickAddItemType }) {
  const controls = useSheet();
  const colors = useColors();
  const notes = useNotes();
  const links = useLinks();
  const memos = useMemos();

  const [type, setType] = useState(initialType);
  const [value, setValue] = useState('');
  // Errors are shown once the user tries to add, not while typing
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  useFocusOnOpen(() => inputRef.current?.focus());

  const info = typeInfo(type);
  const loaded = notes.loaded && links.loaded && memos.loaded;
  const trimmed = value.trim();
  const url = type === 'link' ? normalizeUrl(value) : null;
  const error = !checked
    ? undefined
    : !trimmed
      ? type === 'link'
        ? t('urlRequired')
        : t('titleRequired')
      : type === 'link' && !url
        ? t('urlInvalid')
        : undefined;
  const canAdd = loaded && !busy && trimmed.length > 0;

  const chooseType = (next: QuickAddItemType) => {
    if (next === type) return;
    Haptics.selectionAsync().catch(() => {});
    setType(next);
    setChecked(false);
    inputRef.current?.focus();
  };

  const add = async () => {
    setChecked(true);
    if (!canAdd) return;
    if (type === 'link' && !url) return;
    setBusy(true);
    try {
      if (type === 'pin-note') await notes.createNote({ title: trimmed, body: '', pinned: true, window: null });
      else if (type === 'link') await links.createLink({ url: url!, title: '' });
      else await memos.createMemo({ title: trimmed, body: '' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // A system toast: it stays on screen after the window has closed
      ToastAndroid.show(info.added, ToastAndroid.SHORT);
      controls.dismiss();
    } catch (cause) {
      console.error(cause);
      Alert.alert(t('saveFailed'));
      setBusy(false);
    }
  };

  /**
   * The chosen tool in the app: its list, or, with something typed, a new one in its editor
   * with that text, to add what quick add doesn't have (a description, a time range, a title).
   */
  const openInApp = () => {
    if (!controls.leave()) return;
    const path = type === 'pin-note' ? 'pin-notes' : type === 'note' ? 'notes' : 'links';
    const param = type === 'link' ? 'url' : 'title';
    const target = trimmed ? `zort://${path}/new?${param}=${encodeURIComponent(trimmed)}` : `zort://${path}`;
    Linking.openURL(target)
      .catch((cause) => console.error('Could not open the app', cause))
      // Right away, not with the slide-down: the app is already coming up over it
      .finally(closeQuickAdd);
  };

  return (
    <>
      <View style={styles.types} accessibilityRole="radiogroup">
        {TYPES.map((item) => {
          const selected = item === type;
          const { label, icon } = typeInfo(item);
          return (
            <Pressable
              key={item}
              onPress={() => chooseType(item)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.type,
                selected
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : {
                      backgroundColor: pressed ? colors.surfacePressed : colors.background,
                      borderColor: colors.border,
                    },
              ]}
            >
              <Icon name={icon} size={18} color={selected ? colors.onAccent : colors.textSecondary} />
              <Text style={[styles.typeLabel, { color: selected ? colors.onAccent : colors.text }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        placeholder={info.placeholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={info.maxLength}
        keyboardType={type === 'link' ? 'url' : 'default'}
        autoCapitalize={type === 'link' ? 'none' : 'sentences'}
        autoCorrect={type !== 'link'}
        autoComplete={type === 'link' ? 'url' : 'off'}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={add}
        accessibilityLabel={info.placeholder}
        style={[
          frameStyles.input,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      />
      <Text
        style={[frameStyles.hint, { color: error ? colors.danger : colors.textTertiary }]}
        accessibilityLiveRegion="polite"
      >
        {error ?? info.hint}
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
          accessibilityLabel={`${t('openInApp')}, ${info.label}`}
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
  types: { flexDirection: 'row', gap: spacing.sm },
  type: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
