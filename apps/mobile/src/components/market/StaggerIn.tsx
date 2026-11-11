/**
 * M3 list entrance: rows fade in and slide up 16 pt, each 40 ms after the previous one
 * (≈450 ms, ease-out). Only when `animate` is true (first appearance); Reduce Motion shows the
 * end state directly.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import type { SheetNode } from '@/components/PickerSheet';

const MAX_STAGGERED = 12;

export function StaggerIn({
  index,
  animate,
  style,
  onLayout,
  children,
}: {
  index: number;
  animate: boolean;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: SheetNode;
}) {
  const reduceMotion = useReduceMotion();
  const run = animate && !reduceMotion;
  const progress = useRef(new Animated.Value(run ? 0 : 1)).current;

  useEffect(() => {
    if (!run) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      delay: Math.min(index, MAX_STAGGERED) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </Animated.View>
  );
}

/**
 * Tracks whether a list has been shown before in this app session, so the entrance plays only
 * on first appearance (never on tab switch / pull-to-refresh).
 */
const seen = new Set<string>();
export function useFirstAppearance(key: string, ready: boolean): boolean {
  const first = useRef<boolean | null>(null);
  if (first.current === null && ready) {
    first.current = !seen.has(key);
    seen.add(key);
  }
  return first.current === true;
}
