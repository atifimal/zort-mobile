import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeQuickAdd } from '@modules/quick-add';

import { Icon } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { spacing, useColors } from '@/lib/theme';

export type SheetControls = {
  /** Slides the sheet down, then closes the window. */
  dismiss(): void;
  /**
   * Claims the close for something else (opening the app): true the first time, false if the
   * window is already closing. The caller closes the window itself.
   */
  leave(): boolean;
};

const SheetContext = createContext<SheetControls | null>(null);

/** The controls of the sheet a form is in. */
export function useSheet(): SheetControls {
  const controls = useContext(SheetContext);
  if (!controls) throw new Error('useSheet must be used inside QuickAddFrame');
  return controls;
}

/**
 * The quick-add windows' sheet: slides up from the bottom over the home screen (the scrim behind
 * it is the window's own background), sits on the keyboard, and slides back down on Close, on
 * a tap outside it or on Back.
 */
export function QuickAddFrame({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const closing = useRef(false);

  const [offset] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.spring(offset, { toValue: 0, damping: 22, stiffness: 260, mass: 0.9, useNativeDriver: true }).start();
  }, [offset]);

  const leave = useCallback(() => {
    if (closing.current) return false;
    closing.current = true;
    Keyboard.dismiss();
    return true;
  }, []);

  const dismiss = useCallback(() => {
    if (!leave()) return;
    Animated.timing(offset, {
      toValue: 1,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => closeQuickAdd());
  }, [leave, offset]);

  const controls = useMemo(() => ({ dismiss, leave }), [dismiss, leave]);

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
  }, [dismiss]);

  const translateY = offset.interpolate({ inputRange: [0, 1], outputRange: [0, 560] });

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('close')} />
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
              {title}
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

          <SheetContext.Provider value={controls}>{children}</SheetContext.Provider>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Focuses `focus` once the window is up. */
export function useFocusOnOpen(focus: () => void) {
  useEffect(() => {
    // Not autoFocus: in a window that has only just appeared, Android drops that focus request
    // and the keyboard stays down. Asking once the window is up brings it with the sheet.
    const timer = setTimeout(focus, 150);
    return () => clearTimeout(timer);
    // Only when the window opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export const frameStyles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },
  secondaryAction: { borderWidth: 1 },
  actionText: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  input: {
    fontSize: 17,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  hint: { fontSize: 13, lineHeight: 18, marginTop: -spacing.xs, marginHorizontal: spacing.xs },
});

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
});
