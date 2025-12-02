import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Image, Send, Plus } from './icons';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onImagePress?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export function ChatInput({ value, onChangeText, onSend, onImagePress, onTypingStart, onTypingStop }: ChatInputProps) {
  const { colors, fonts } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const sendButtonScale = useRef(new Animated.Value(value.trim().length > 0 ? 1 : 0)).current;
  const sendButtonRotate = useRef(new Animated.Value(0)).current;
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Animate send button
    Animated.parallel([
      Animated.spring(sendButtonScale, {
        toValue: value.trim().length > 0 ? 1 : 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonRotate, {
        toValue: value.trim().length > 0 ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value]);

  const handleTextChange = (text: string) => {
    onChangeText(text);

    // Handle typing indicators
    if (text.length > 0) {
      if (!typingTimeoutRef.current) {
        onTypingStart?.();
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop?.();
        typingTimeoutRef.current = undefined;
      }, 3000);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }
      onTypingStop?.();
    }
  };

  const handleSend = () => {
    if (value.trim().length > 0) {
      onSend();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }
      onTypingStop?.();
    }
  };

  const sendButtonRotation = sendButtonRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: Platform.OS === 'ios' ? 8 : 8,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 44,
      borderWidth: isFocused ? 1.5 : 0,
      borderColor: isFocused ? colors.primary : 'transparent',
    },
    iconButton: {
      marginRight: 8,
      padding: 4,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.text,
      maxHeight: 100,
      paddingTop: Platform.OS === 'ios' ? 8 : 0,
      paddingBottom: Platform.OS === 'ios' ? 8 : 0,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {onImagePress && (
          <TouchableOpacity onPress={onImagePress} style={styles.iconButton}>
            <Plus size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
        />
      </View>
      <Animated.View
        style={{
          transform: [
            { scale: sendButtonScale },
            { rotate: sendButtonRotation },
          ],
        }}
      >
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={value.trim().length === 0}
        >
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
