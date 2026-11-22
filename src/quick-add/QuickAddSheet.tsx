import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeQuickAdd, type QuickAddType } from '@modules/quick-add';

import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { useLinks } from '@/lib/links-context';
import { useMemos } from '@/lib/memos-context';
import { useNotes } from '@/lib/notes-context';
import { limits, radius, spacing, useColors } from '@/lib/theme';
import { normalizeUrl } from '@/lib/url';

const MAX_URL = 2048;

type TypeInfo = {
  label: string;
  icon: IconName;
  placeholder: string;
  hint: string;
  added: string;
  maxLength: number;
};

const typeInfo = (type: QuickAddType): TypeInfo => {
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

const TYPES: readonly QuickAddType[] = ['pin-note', 'note', 'link'];

/**
 * The quick-add sheet: pick what to add, type the one thing it needs (a Pin Note's title, a
 * link's address, a note's title) and add it. The rest (a description, a time range, a link's
 * title) can be filled in later in the app.
 */
export function QuickAddSheet({ initialType }: { initialType: QuickAddType }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const notes = useNotes();
  const links = useLinks();
  const memos = useMemos();

  const [type, setType] = useState(initialType);
  const [value, setValue] = useState('');
  // Errors are shown once the user tries to add, not while typing
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  const closing = useRef(false);

  // Slides up when it opens and back down when it closes; the scrim behind it is the window's
  const [offset] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.spring(offset, { toValue: 0, damping: 22, stiffness: 260, mass: 0.9, useNativeDriver: true }).start();
    // Not autoFocus: in a window that has only just appeared, Android drops that focus request
    // and the keyboard stays down. Asking once the window is up brings it with the sheet.
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [offset]);

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

  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.timing(offset, {
      toValue: 1,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => closeQuickAdd());
  };

  // With the keyboard up, the sheet sits on it: the navigation bar's inset would only add a gap
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardShown(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardShown(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Back closes with the same animation instead of cutting the window off
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  });

  const chooseType = (next: QuickAddType) => {
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
      dismiss();
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
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    const path = type === 'pin-note' ? 'pin-notes' : type === 'note' ? 'notes' : 'links';
    const param = type === 'link' ? 'url' : 'title';
    const target = trimmed ? `zort://${path}/new?${param}=${encodeURIComponent(trimmed)}` : `zort://${path}`;
    Linking.openURL(target)
      .catch((cause) => console.error('Could not open the app', cause))
      // Right away, not with the slide-down: the app is already coming up over it
      .finally(closeQuickAdd);
  };

  const translateY = offset.interpolate({ inputRange: [0, 1], outputRange: [0, 480] });

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('close')}
      />
      <KeyboardAvoidingView behavior="padding">
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: (keyboardShown ? spacing.lg : Math.max(insets.bottom, spacing.lg)) + spacing.sm,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {t('quickAddTitle')}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: pressed ? colors.surfacePressed : colors.background },
              ]}
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

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
                  <Text
                    style={[styles.typeLabel, { color: selected ? colors.onAccent : colors.text }]}
                    numberOfLines={1}
                  >
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
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.background,
                borderColor: error ? colors.danger : colors.border,
              },
            ]}
          />
          <Text
            style={[styles.hint, { color: error ? colors.danger : colors.textTertiary }]}
            accessibilityLiveRegion="polite"
          >
            {error ?? info.hint}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={add}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdd, busy }}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? colors.accentPressed : colors.accent, opacity: canAdd ? 1 : 0.45 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Icon name="add" size={20} color={colors.onAccent} />
                  <Text style={[styles.actionText, { color: colors.onAccent }]} numberOfLines={1}>
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
                styles.action,
                styles.secondaryAction,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Icon name="openApp" size={18} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>
                {t('openInApp')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  title: { fontSize: 20, fontWeight: '700' },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
  input: {
    fontSize: 17,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  hint: { fontSize: 13, lineHeight: 18, marginTop: -spacing.xs, marginHorizontal: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
  },
  secondaryAction: { borderWidth: 1 },
  actionText: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
});
