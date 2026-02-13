import React from 'react';
import { Platform, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const supportsGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface GlassWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

export const GlassWrapper = React.memo(function GlassWrapper({
  children,
  style,
  fallbackStyle,
  intensity = 80,
  tint = 'light',
}: GlassWrapperProps) {
  // iOS 26+: Native Liquid Glass
  if (supportsGlass) {
    return (
      <GlassView style={style}>
        {children}
      </GlassView>
    );
  }

  // iOS < 26: BlurView fallback
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  // Android: Plain View fallback
  return <View style={[style, fallbackStyle]}>{children}</View>;
});
