/** M5 skeleton block: grey placeholder with a slow (1.2 s) shimmer; static with Reduce Motion. */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

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
