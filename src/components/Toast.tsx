import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/lib/theme';

const VISIBLE_MS = 1800;

/** A short message at the bottom of the screen, e.g. "Link copied". Render `toast` last. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
      }, VISIBLE_MS);
    },
    [opacity],
  );

  const toast = message ? (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: insets.bottom + spacing.xxl, opacity }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  ) : null;

  return { toast, show };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    // Same in both themes: a dark pill reads on light and dark backgrounds alike
    backgroundColor: 'rgba(31,35,40,0.92)',
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});
