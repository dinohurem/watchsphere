/**
 * Motion helpers (spec v3, section 12). Motion is functional feedback: short, never looping,
 * never blocking input, and fully disabled when Reduce Motion is on (end state shown directly).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { SheetNode } from '@/components/PickerSheet';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export { useReduceMotion };

/**
 * M2 – number counts up from 0 to `value` over ≈500 ms with ease-out, keeping the final format
 * (e.g. the "k" abbreviation) during the count. Only when `animate` is true (first appearance).
 */
export function CountUpText({
  value,
  format,
  animate,
  style,
  numberOfLines,
}: {
  value: number | null | undefined;
  format: (value: number) => string;
  animate: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const reduce = useReduceMotion();
  const target = value ?? 0;
  const [display, setDisplay] = useState<number>(animate && !reduce ? 0 : target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!animate || reduce || value === null || value === undefined) {
      setDisplay(target);
      return;
    }
    const start = Date.now();
    const duration = 500;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animate, reduce]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {value === null || value === undefined ? format(NaN) : format(display)}
    </Text>
  );
}

/**
 * M1 – star / bell tap. When `active` turns on the icon scales 1.0 → 1.3 → 1.0 (spring ≈350 ms);
 * with `wiggle` it also rotates once (±14°, ≈500 ms). Turning off plays no scale (the icon just
 * swaps to its outline state). Nothing runs on first mount.
 */
export function PopIcon({
  active,
  wiggle,
  armed = true,
  children,
  style,
}: {
  active: boolean;
  wiggle?: boolean;
  /**
   * Only animate (and buzz) when the change came from the user's tap – pass false while the
   * state is still being loaded so an already-followed watch doesn't pop on open.
   */
  armed?: boolean;
  children: SheetNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const previous = useRef(active);

  useEffect(() => {
    const was = previous.current;
    previous.current = active;
    if (!active || was || !armed) return;
    // M1: light haptic (UIImpactFeedbackGenerator .light) – not motion, so also with Reduce Motion.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (reduce) return;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
    if (wiggle) {
      rotate.setValue(0);
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 125, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -1, duration: 200, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 175, useNativeDriver: true }),
      ]).start();
    }
  }, [active, wiggle, armed, reduce, scale, rotate]);

  const spin = rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  return (
    <Animated.View style={[style, { transform: [{ scale }, { rotate: spin }] }]}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </Animated.View>
  );
}

