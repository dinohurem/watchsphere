import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  // Animation values
  const wOpacity = useRef(new Animated.Value(0)).current;
  const wScale = useRef(new Animated.Value(0.8)).current;

  const sProgress = useRef(new Animated.Value(0)).current;
  const sOpacity = useRef(new Animated.Value(0)).current;

  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start the animation sequence
    Animated.sequence([
      // Phase 1: W appears (0-600ms)
      Animated.parallel([
        Animated.timing(wOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(wScale, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: S enters and weaves (600-2400ms = 1800ms)
      Animated.parallel([
        Animated.timing(sOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sProgress, {
          toValue: 1,
          duration: 1800,
          easing: (t) => {
            // Custom easing: fast at start, slow at end
            return t < 0.7 ? t * 1.2 : 0.84 + (t - 0.7) * 0.533;
          },
          useNativeDriver: true,
        }),
      ]),

      // Phase 3: Glow effect (2400-3000ms = 600ms)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.15,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      // Animation complete, wait a moment then callback
      setTimeout(() => {
        onAnimationComplete?.();
      }, 200);
    });
  }, []);

  // Calculate S position based on progress - weaving through W
  const sTranslateX = sProgress.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [250, 80, 20, -15, -5, 0], // Weaving motion from right to left
  });

  const sTranslateY = sProgress.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [-200, -80, -20, 10, 5, 0], // Descending from top
  });

  const sRotate = sProgress.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: ['25deg', '15deg', '5deg', '-3deg', '-1deg', '0deg'], // Rotation for weaving effect
  });

  // Z-index animation to create weaving illusion (going behind and in front of W)
  const sZIndex = sProgress.interpolate({
    inputRange: [0, 0.3, 0.5, 0.7, 1],
    outputRange: [10, 5, 10, 5, 10], // Alternates between front and back
  });

  // Scale for subtle size change during weaving
  const sScale = sProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1.2, 1.1, 1], // Starts slightly larger, settles to final size
  });

  return (
    <View style={styles.container}>
      {/* Glow effect layer */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      >
        <View style={styles.glow} />
      </Animated.View>

      {/* Logo container */}
      <View style={styles.logoContainer}>
        {/* W Letter */}
        <Animated.View
          style={[
            styles.letterContainer,
            {
              opacity: wOpacity,
              transform: [{ scale: wScale }],
            },
          ]}
        >
          <Svg width={140} height={100} viewBox="0 0 140 100">
            {/* W shape - geometric, sharp angles */}
            <Path
              d="M 10 10 L 30 90 L 50 40 L 70 90 L 90 40 L 110 90 L 130 10"
              stroke="#FFFFFF"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="miter"
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* S Letter - weaving through */}
        <Animated.View
          style={[
            styles.letterContainer,
            styles.sLetter,
            {
              opacity: sOpacity,
              transform: [
                { translateX: sTranslateX },
                { translateY: sTranslateY },
                { rotate: sRotate },
                { scale: sScale },
              ],
            },
          ]}
        >
          <Svg width={90} height={130} viewBox="0 0 90 130">
            <Defs>
              <LinearGradient id="sGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="50%" stopColor="#F5F5F5" stopOpacity="1" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            {/* S shape - elegant, flowing ribbon */}
            <Path
              d="M 65 25 Q 75 18 75 30 Q 75 42 60 48 Q 45 54 35 60 Q 25 66 25 78 Q 25 90 40 96 Q 50 100 55 98"
              stroke="url(#sGradient)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Brand name text (subtle, appears at the end) */}
      <Animated.View
        style={[
          styles.brandTextContainer,
          {
            opacity: sProgress.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [0, 0, 1],
            }),
          },
        ]}
      >
        {/* We'll add the brand name text later if needed */}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  letterContainer: {
    position: 'absolute',
  },
  sLetter: {
    zIndex: 10, // S appears on top during weaving
  },
  glowContainer: {
    position: 'absolute',
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 20,
  },
  brandTextContainer: {
    position: 'absolute',
    bottom: 100,
  },
});
