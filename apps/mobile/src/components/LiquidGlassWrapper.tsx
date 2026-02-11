import React from 'react';
import { Platform, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

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
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint={tint} style={style}>
        {children}
      </BlurView>
    );
  }

  return <View style={[style, fallbackStyle]}>{children}</View>;
});
