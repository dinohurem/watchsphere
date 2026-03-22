import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  const hasCompleted = useRef(false);

  const handleAnimationFinish = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    onAnimationComplete?.();
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/splash_animation.json')}
        autoPlay
        loop={false}
        speed={1}
        onAnimationFinish={handleAnimationFinish}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D1D1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: '100%',
    aspectRatio: 1920 / 1080,
  },
});
