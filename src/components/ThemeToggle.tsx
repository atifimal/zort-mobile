import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { t } from '@/lib/i18n';
import { useThemeToggle } from '@/lib/theme-preference';

// Same look as zort.ing's switch: a pill whose knob carries a sun, or a moon once slid across
const palette = {
  light: { track: '#E7ECF2', border: '#D1D9E0', knob: '#FFFFFF', icon: '#D4A72C' },
  dark: { track: '#1D2633', border: '#3D444D', knob: '#2B3442', icon: '#C9D1D9' },
};

const WIDTH = 56;
const HEIGHT = 32;
const KNOB = 26;
const INSET = (HEIGHT - KNOB) / 2 - StyleSheet.hairlineWidth;
const TRAVEL = WIDTH - KNOB - INSET * 2 - StyleSheet.hairlineWidth * 2;

export function ThemeToggle() {
  const { dark, toggle } = useThemeToggle();
  const colors = dark ? palette.dark : palette.light;
  const [position] = useState(() => new Animated.Value(dark ? 1 : 0));

  useEffect(() => {
    Animated.timing(position, {
      toValue: dark ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dark, position]);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        toggle();
      }}
      accessibilityRole="switch"
      accessibilityLabel={t('darkTheme')}
      accessibilityState={{ checked: dark }}
      hitSlop={8}
      style={[styles.track, { backgroundColor: colors.track, borderColor: colors.border }]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: colors.knob,
            transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }],
          },
        ]}
      >
        <Icon name={dark ? 'moon' : 'sun'} size={16} color={colors.icon} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: INSET,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
