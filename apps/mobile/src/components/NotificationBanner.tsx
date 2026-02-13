import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { wp, hp, sp, fp } from '@/utils/responsive';

// App notification icon
const notificationImage = require('../../assets/images/notification-image.png');

export interface NotificationData {
  id: string;
  type?: 'message' | 'buy_offer' | 'price_alert';
  title: string;
  body: string;
  avatar?: string;
  conversationId?: string;
  isGroup?: boolean;
  orderId?: string;
  reference?: string;
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
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const formatTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  if (!notification) {
    return null;
  }

  // For chat notifications, use avatar; for other notifications, use app icon
  const isChat = notification.type === 'message';
  const imageSource = isChat && notification.avatar
    ? { uri: notification.avatar }
    : notificationImage;

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
        {/* App Icon or Avatar */}
        <Image source={imageSource} style={styles.appIcon} />

        {/* Content */}
        <View style={styles.content}>
          {/* Title and Time Row */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {isChat ? notification.title : 'WatchSphere'}
            </Text>
            <Text style={[styles.time, { fontFamily: fonts.regular }]}>
              {formatTime()}
            </Text>
          </View>
          {/* Body */}
          <Text style={[styles.body, { fontFamily: fonts.regular }]} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
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
    backgroundColor: '#FFFFFF',
    borderRadius: sp(21),
    paddingVertical: hp(11),
    paddingHorizontal: wp(12),
    gap: wp(9),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 29,
    elevation: 10,
  },
  appIcon: {
    width: sp(33),
    height: sp(33),
    borderRadius: sp(8),
  },
  content: {
    flex: 1,
    gap: hp(0),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(14),
  },
  title: {
    flex: 1,
    fontSize: fp(13),
    color: '#212121',
    letterSpacing: -0.2,
    lineHeight: fp(15),
  },
  time: {
    fontSize: fp(13),
    color: '#4D4D4D',
    lineHeight: fp(15),
  },
  body: {
    fontSize: fp(13),
    color: '#212121',
    letterSpacing: -0.2,
    lineHeight: fp(16),
  },
});
