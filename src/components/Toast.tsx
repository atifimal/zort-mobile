import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/lib/theme';

const VISIBLE_MS = 1800;
// Long enough to read the message and reach the button
const WITH_ACTION_MS = 4500;

export type ToastAction = { label: string; onPress: () => void };

/**
 * A short message at the bottom of the screen, e.g. "Link copied", optionally with one action
 * ("Undo"). Render `toast` last. `above`: room to keep free at the bottom, e.g. for a + button.
 */
export function useToast({ above = 0 }: { above?: number } = {}) {
  const [message, setMessage] = useState<{ text: string; action?: ToastAction } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
  }, [opacity]);

  const show = useCallback(
    (text: string, action?: ToastAction) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage({ text, action });
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, action ? WITH_ACTION_MS : VISIBLE_MS);
    },
    [opacity, hide],
  );

  const action = message?.action;
  const toast = message ? (
    <Animated.View
      pointerEvents={action ? 'box-none' : 'none'}
      accessibilityLiveRegion="polite"
      style={[styles.toast, action && styles.withAction, { bottom: insets.bottom + spacing.xxl + above, opacity }]}
    >
      <Text style={styles.text} numberOfLines={2}>
        {message.text}
      </Text>
      {action ? (
        <Pressable
          onPress={() => {
            hide();
            action.onPress();
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  ) : null;

  return { toast, show };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '92%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    // Same in both themes: a dark pill reads on light and dark backgrounds alike
    backgroundColor: 'rgba(31,35,40,0.92)',
  },
  withAction: { paddingRight: spacing.xs, gap: spacing.sm },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', flexShrink: 1 },
  action: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.14)' },
  // Light blue: reads on the dark pill in both themes
  actionText: { color: '#79C0FF', fontSize: 14, fontWeight: '700' },
});
