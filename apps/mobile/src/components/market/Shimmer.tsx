/** M5 skeleton block: grey placeholder with a slow (1.2 s) shimmer; static with Reduce Motion. */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import type { SheetNode } from '@/components/PickerSheet';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import { UI } from './tokens';

export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, value]);

  return (
    <Animated.View
      style={[
        { backgroundColor: UI.fill, borderRadius: 6 },
        style,
        {
          opacity: reduceMotion
            ? 1
            : value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
        },
      ]}
    />
  );
}

/**
 * M5 hand-over: shows `skeleton` while `loading`; when loading finishes the content fades in
 * while the skeleton fades out on top of it (≈400 ms). Content that was already cached (never
 * loading) appears directly. Reduce Motion swaps without animation.
 */
export function SkeletonCrossFade({
  loading,
  skeleton,
  children,
  style,
  onLayout,
}: {
  loading: boolean;
  skeleton: SheetNode;
  children: SheetNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(loading ? 0 : 1)).current;
  const wasLoading = useRef(loading);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (loading) {
      progress.setValue(0);
    } else if (wasLoading.current) {
      if (reduceMotion) {
        progress.setValue(1);
      } else {
        setFading(true);
        Animated.timing(progress, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(() => setFading(false));
      }
    }
    wasLoading.current = loading;
  }, [loading, reduceMotion, progress]);

  return (
    <View style={style} onLayout={onLayout}>
      {loading ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (skeleton as any)
      ) : (
        <Animated.View style={[style ? styles.fill : null, { opacity: progress }]}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {children as any}
        </Animated.View>
      )}
      {!loading && fading ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {skeleton as any}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, flexShrink: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
