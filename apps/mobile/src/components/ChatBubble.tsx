import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Check } from './icons';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  senderName?: string;
  showSender?: boolean;
}

export function ChatBubble({ message, isUser, timestamp, status, senderName, showSender }: ChatBubbleProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const styles = StyleSheet.create({
    container: {
      marginVertical: 4,
      paddingHorizontal: 16,
      alignItems: 'flex-start',
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    },
    userContainer: {
      alignItems: 'flex-end',
    },
    senderName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
      marginLeft: 4,
    },
    bubble: {
      maxWidth: '75%',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    userBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    otherBubble: {
      backgroundColor: colors.backgroundSecondary,
      borderBottomLeftRadius: 4,
    },
    text: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.text,
      lineHeight: 20,
    },
    userText: {
      color: '#FFFFFF',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    timestamp: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

  const renderStatusIcon = () => {
    if (!isUser || !status) return null;

    const getStatusColor = () => {
      switch (status) {
        case 'sending':
          return colors.textTertiary;
        case 'sent':
          return colors.textTertiary;
        case 'delivered':
          return colors.textSecondary;
        case 'read':
          return colors.primary;
        default:
          return colors.textTertiary;
      }
    };

    const showDoubleCheck = status === 'delivered' || status === 'read';

    return (
      <View style={styles.statusContainer}>
        {status === 'sending' ? (
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textTertiary, opacity: 0.5 }} />
        ) : (
          <>
            <Check size={14} color={getStatusColor()} />
            {showDoubleCheck && (
              <Check size={14} color={getStatusColor()} style={{ marginLeft: -6 }} />
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, isUser && styles.userContainer]}>
      {showSender && senderName && !isUser && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.otherBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message}</Text>
      </View>
      <View style={styles.footer}>
        {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
        {renderStatusIcon()}
      </View>
    </Animated.View>
  );
}
