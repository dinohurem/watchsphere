import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  senderName?: string;
  showSender?: boolean;
  isAI?: boolean;
}

export function ChatBubble({ message, isUser, timestamp, status, senderName, showSender, isAI = false }: ChatBubbleProps) {
  const { colors, fonts } = useTheme();
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
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      marginBottom: 4,
      marginLeft: 4,
    },
    bubble: {
      maxWidth: '75%',
      paddingHorizontal: isAI && !isUser ? 0 : 16,
      paddingVertical: isAI && !isUser ? 0 : 10,
      borderRadius: isAI && !isUser ? 0 : 18,
      shadowColor: isAI && !isUser ? 'transparent' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isAI && !isUser ? 0 : 0.05,
      shadowRadius: 2,
      elevation: isAI && !isUser ? 0 : 1,
    },
    userBubble: {
      backgroundColor: '#212121',
      borderBottomRightRadius: 4,
    },
    otherBubble: {
      backgroundColor: isAI ? 'transparent' : colors.backgroundSecondary,
      borderBottomLeftRadius: 4,
    },
    text: {
      fontSize: 15,
      fontFamily: fonts.regular,
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
  });

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
      </View>
    </Animated.View>
  );
}
