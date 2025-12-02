import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
}

// Splash logo icon (watch symbol from Figma)
function SplashLogo({ width = 119, height = 100 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 119 100" fill="none">
      <Path fillRule="evenodd" clipRule="evenodd" d="M72.6182 46.2227H81.4295L83.2371 34.1746C83.3226 33.5992 83.8364 33.1804 84.4439 33.1804H88.0525C88.8353 33.1804 89.4266 33.8622 89.2878 34.6037L87.0914 46.2227H89.5709C97.188 46.2227 103.367 52.5359 103.367 60.3191C103.367 68.1022 97.188 74.4154 89.5709 74.4154H82.4578L80.8088 83.5791C80.7233 84.1545 80.2095 84.5733 79.602 84.5733H72.6019C71.9944 84.5733 71.4806 84.1545 71.3951 83.5791L69.746 74.4154H51.5862L49.937 83.5791C49.8515 84.1545 49.3377 84.5733 48.7302 84.5733H41.7302C41.1227 84.5733 40.6088 84.1545 40.5234 83.5791L38.8743 74.4154H15.0098C14.3154 74.4154 13.7533 73.8723 13.7533 73.201V69.7869C13.7533 69.1156 14.3154 68.5724 15.0098 68.5724H77.4954L80.9226 50.27H72.0405L74.236 61.9122C74.3748 62.6537 73.7836 63.3354 72.9997 63.3354H69.3912C68.7837 63.3354 68.2699 62.9166 68.1845 62.3413L62.6175 33.6268C62.4786 32.8853 63.0699 32.2036 63.8538 32.2036H67.4634C68.0709 32.2036 68.5847 32.6224 68.6702 33.1977L72.6182 46.2227ZM83.084 68.5724H89.5709C94.6377 68.5724 98.7387 64.881 98.7387 60.3191C98.7387 55.7571 94.6377 52.0657 89.5709 52.0657H86.0062L83.084 68.5724Z" fill="#F7F7F7"/>
      <Path fillRule="evenodd" clipRule="evenodd" d="M35.5367 22.1126H55.6215L57.4709 10.2461C57.5564 9.67073 58.0702 9.25195 58.6777 9.25195H65.6777C66.2852 9.25195 66.799 9.67073 66.8845 10.2461L68.7339 22.1126H88.8187L90.668 10.2461C90.7535 9.67073 91.2673 9.25195 91.8748 9.25195H95.4833C96.2672 9.25195 96.8584 9.9337 96.7196 10.6752L94.5232 22.1126H106.649C107.343 22.1126 107.905 22.6557 107.905 23.327V26.7411C107.905 27.4124 107.343 27.9556 106.649 27.9556H36.9534L40.3821 46.2227H51.4295L53.6259 33.1977C53.7114 32.6224 54.2252 32.2036 54.8327 32.2036H58.4423C59.2262 32.2036 59.8174 32.8853 59.6786 33.6268L54.1117 62.3413C54.0262 62.9166 53.5124 63.3354 52.9049 63.3354H49.2953C48.5114 63.3354 47.9202 62.6537 48.059 61.9122L50.2555 50.27H42.1316L44.328 61.9122C44.4668 62.6537 43.8756 63.3354 43.0917 63.3354H39.4832C38.8757 63.3354 38.3618 62.9166 38.2764 62.3413L35.9585 50.27H29.3754C21.7584 50.2693 15.5809 43.9542 15.5809 36.1711C15.5809 28.4163 21.7212 22.1339 29.3024 22.1126L26.7804 10.6752C26.6415 9.9337 27.2328 9.25195 28.0167 9.25195H31.6263C32.2338 9.25195 32.7476 9.67073 32.8331 10.2461L35.5367 22.1126ZM20.209 36.1711C20.209 41.2237 24.3097 45.2821 29.3754 45.2835H33.8343L30.4057 27.9541C25.0789 27.9541 20.209 31.3605 20.209 36.1711Z" fill="#F7F7F7"/>
    </Svg>
  );
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Simple fade-in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation complete, wait a moment then callback
      setTimeout(() => {
        onAnimationComplete?.();
      }, 500);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <SplashLogo width={119} height={100} />
      </Animated.View>
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
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
