/**
 * CK7b – Bracelet photo, full screen. Black viewer: close (x) left, title, share right; pinch to
 * zoom up to 4x, double-tap resets, swipe down closes. The full-resolution image is loaded (the
 * thumbnail shows first) so single links can be counted. Reduce Motion: no animated reset/close.
 */
import React, { useState } from 'react';
import { Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareUpIcon } from '@/components/checks/CheckIcons';
import { X } from '@/components/icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fp, hp, sp, wp } from '@/utils/responsive';

const MAX_SCALE = 4;
const CLOSE_DISTANCE = 120;

export default function BraceletPhotoScreen() {
  const { fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { url, thumb, title, links } = useLocalSearchParams<{
    url?: string;
    thumb?: string;
    title?: string;
    links?: string;
  }>();
  const [fullLoaded, setFullLoaded] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const duration = reduceMotion ? 0 : 200;

  const close = () => router.back();

  const reset = () => {
    'worklet';
    scale.value = withTiming(1, { duration });
    savedScale.value = 1;
    tx.value = withTiming(0, { duration });
    ty.value = withTiming(0, { duration });
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        reset();
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else if (e.translationY > 0) {
        // Swipe down to close – the photo follows the finger.
        ty.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      } else if (e.translationY > CLOSE_DISTANCE || e.velocityY > 900) {
        runOnJS(close)();
      } else {
        ty.value = withTiming(0, { duration });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      reset();
    });

  const gesture = Gesture.Simultaneous(doubleTap, pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({
    opacity: savedScale.value > 1 ? 1 : Math.max(0.35, 1 - Math.abs(ty.value) / 500),
  }));

  const share = async () => {
    try {
      await Share.share({ message: `${title ?? 'Bracelet'}\n${url ?? ''}`.trim(), url });
    } catch {
      // dismissed
    }
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.stage, imageStyle]}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.image} resizeMode="contain" />
          ) : null}
          {url ? (
            <Image
              source={{ uri: url }}
              style={[styles.image, StyleSheet.absoluteFill, { opacity: fullLoaded ? 1 : 0 }]}
              resizeMode="contain"
              onLoad={() => setFullLoaded(true)}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>

      <View style={[styles.top, { paddingTop: insets.top + hp(6) }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.round} onPress={close} accessibilityLabel="Close">
          <X size={sp(18)} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity style={styles.round} onPress={share} accessibilityLabel="Share">
          <ShareUpIcon size={sp(18)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + hp(16) }]} pointerEvents="none">
        <View style={styles.pill}>
          <Text style={[styles.pillText, { fontFamily: fonts.medium }]}>
            Pinch to zoom · double-tap to reset
          </Text>
        </View>
        {links ? (
          <View style={styles.pill}>
            <Text style={[styles.pillText, { fontFamily: fonts.medium }]}>Full links: {links}</Text>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  bg: { backgroundColor: '#000000' },
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    gap: wp(12),
  },
  round: {
    width: sp(34),
    height: sp(34),
    borderRadius: sp(17),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', fontSize: fp(15), color: '#FFFFFF' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: hp(8) },
  pill: {
    paddingHorizontal: wp(14),
    paddingVertical: sp(6),
    borderRadius: sp(16),
    backgroundColor: 'rgba(60,60,60,0.85)',
  },
  pillText: { fontSize: fp(12), color: '#FFFFFF' },
});
