import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard, Platform } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Photo, ArrowUp } from './icons';
import * as ImagePicker from 'expo-image-picker';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onImageSelect?: (uri: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export function ChatInput({ value, onChangeText, onSend, onImageSelect, onTypingStart, onTypingStop }: ChatInputProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [isFocused, setIsFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const sendButtonOpacity = useRef(new Animated.Value(1)).current;
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    // Animate send button opacity based on text content
    Animated.timing(sendButtonOpacity, {
      toValue: value.trim().length > 0 ? 1 : 0.5,
      duration: 150,
      useNativeDriver: true,
    }).start();
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

  const handleImagePress = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access media library was denied');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelect?.(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  // Calculate bottom padding: use safe area inset when keyboard is hidden, minimal padding when visible
  const bottomPadding = isKeyboardVisible ? 10 : Math.max(insets.bottom, 10);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: bottomPadding,
      backgroundColor: colors.background,
      gap: 8,
    },
    imageButton: {
      width: 44,
      height: 44,
      borderRadius: 99,
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      borderRadius: 99,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 44,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.075,
      maxHeight: 100,
      padding: 0,
      margin: 0,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 99,
      backgroundColor: '#212121',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
  });

  return (
    <View style={styles.container}>
      {/* Image picker button */}
      <TouchableOpacity style={styles.imageButton} onPress={handleImagePress}>
        <Photo size={18} color="#212121" />
      </TouchableOpacity>

      {/* Text input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Send message..."
          placeholderTextColor="rgba(33, 33, 33, 0.5)"
          multiline
          maxLength={2000}
        />
      </View>

      {/* Send button */}
      <Animated.View style={{ opacity: sendButtonOpacity }}>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={value.trim().length === 0}
        >
          <ArrowUp size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
