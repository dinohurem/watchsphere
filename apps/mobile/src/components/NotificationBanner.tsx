import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { MessageCircle } from '@/components/icons';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  avatar?: string;
  conversationId?: string;
  isGroup?: boolean;
  timestamp: Date;
}

interface NotificationBannerProps {
  notification: NotificationData | null;
  onPress?: (notification: NotificationData) => void;
  onDismiss?: () => void;
  duration?: number; // Auto-dismiss duration in ms
}

export function NotificationBanner({
  notification,
  onPress,
  onDismiss,
  duration = 4000,
}: NotificationBannerProps) {
  const { fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notification) {
      // Show the banner
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
      dismissTimer.current = setTimeout(() => {
        hideBanner();
      }, duration);
    } else {
      // Hide immediately if notification is null
      translateY.setValue(-100);
      opacity.setValue(0);
    }

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, [notification]);

  const hideBanner = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handlePress = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    hideBanner();
    if (notification) {
      onPress?.(notification);
    }
  };

  if (!notification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + hp(8),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Avatar or Icon */}
        <View style={styles.avatarContainer}>
          {notification.avatar ? (
            <Image source={{ uri: notification.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.iconContainer}>
              <MessageCircle size={20} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={[styles.body, { fontFamily: fonts.regular }]} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>

        {/* Time indicator */}
        <Text style={[styles.time, { fontFamily: fonts.regular }]}>now</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: wp(16),
    right: wp(16),
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#212121',
    borderRadius: sp(16),
    paddingVertical: hp(12),
    paddingHorizontal: wp(14),
    gap: wp(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  avatarContainer: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0088FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: hp(2),
  },
  title: {
    fontSize: fp(14),
    color: '#FFFFFF',
    letterSpacing: 0.07,
  },
  body: {
    fontSize: fp(13),
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.065,
    lineHeight: fp(18),
  },
  time: {
    fontSize: fp(12),
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
