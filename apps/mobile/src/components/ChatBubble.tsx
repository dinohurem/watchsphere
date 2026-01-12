import { View, Text, StyleSheet, Animated, TouchableOpacity, Pressable } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export interface QuotedMessage {
  id: string;
  content: string;
  senderName: string;
  senderId: string;
}

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  senderName?: string;
  showSender?: boolean;
  isAI?: boolean;
  quotedMessage?: QuotedMessage;
  onLongPress?: () => void;
  messageId?: string;
  senderId?: string;
  isGroupChat?: boolean;
  showAvatar?: boolean;
  onAvatarPress?: (senderId: string) => void;
}

export function ChatBubble({ message, isUser, timestamp, status, senderName, showSender, isAI = false, quotedMessage, onLongPress, messageId, senderId, isGroupChat = false, showAvatar = false, onAvatarPress }: ChatBubbleProps) {
  const { colors, fonts } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Get initials from sender name
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

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

  // Determine if we should show the avatar for this message
  const shouldShowAvatar = isGroupChat && !isUser && showAvatar;
  const avatarSpacing = isGroupChat && !isUser ? 40 : 0; // Space for avatar column

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
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    avatarColumn: {
      width: 32,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 11,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    senderName: {
      fontSize: 12,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      marginBottom: 4,
      marginLeft: isGroupChat ? 40 : 4,
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
    timestampRow: {
      flexDirection: 'row',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginTop: 4,
    },
    timestamp: {
      fontSize: 10,
      color: isUser ? 'rgba(255, 255, 255, 0.5)' : colors.textTertiary,
    },
    quotedContainer: {
      backgroundColor: isUser ? 'rgba(255, 255, 255, 0.15)' : 'rgba(33, 33, 33, 0.08)',
      borderLeftWidth: 3,
      borderLeftColor: isUser ? 'rgba(255, 255, 255, 0.5)' : colors.primary,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 6,
    },
    quotedSender: {
      fontSize: 12,
      fontFamily: fonts.semiBold,
      color: isUser ? 'rgba(255, 255, 255, 0.8)' : colors.primary,
      marginBottom: 2,
    },
    quotedText: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: isUser ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary,
      lineHeight: 18,
    },
  });

  const bubbleContent = (
    <>
      {quotedMessage && (
        <View style={styles.quotedContainer}>
          <Text style={styles.quotedSender} numberOfLines={1}>
            {quotedMessage.senderName}
          </Text>
          <Text style={styles.quotedText} numberOfLines={2}>
            {quotedMessage.content}
          </Text>
        </View>
      )}
      <Text style={[styles.text, isUser && styles.userText]}>{message}</Text>
      {timestamp && (
        <View style={styles.timestampRow}>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      )}
    </>
  );

  return (
    <Animated.View style={[styles.container, isUser && styles.userContainer]}>
      {showSender && senderName && !isUser && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}
      <View style={isGroupChat && !isUser ? styles.messageRow : undefined}>
        {/* Avatar column for group chat - only show avatar on last message of a block */}
        {isGroupChat && !isUser && (
          <TouchableOpacity
            style={styles.avatarColumn}
            onPress={() => senderId && onAvatarPress?.(senderId)}
            disabled={!onAvatarPress || !senderId}
            activeOpacity={0.7}
          >
            {shouldShowAvatar && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(senderName || '')}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={300}
          style={({ pressed }) => [
            styles.bubble,
            isUser ? styles.userBubble : styles.otherBubble,
            pressed && { opacity: 0.8 },
          ]}
        >
          {bubbleContent}
        </Pressable>
      </View>
    </Animated.View>
  );
}
