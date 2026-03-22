import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingAnimationProps {
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export function LoadingAnimation({ size = 'large', style }: LoadingAnimationProps) {
  const dimensions = size === 'large' ? 160 : 120;

  return (
    <View style={[size === 'large' ? styles.containerLarge : styles.containerSmall, style]}>
      <LottieView
        source={require('../../assets/loading_animation_dark.json')}
        autoPlay
        loop
        style={{ width: dimensions, height: dimensions * 0.56 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  containerLarge: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
});
