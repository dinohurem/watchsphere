import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, AISparkle } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';

// Arrow up icon for send button (matches Figma)
function ArrowUpIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 15.8333V4.16667M10 4.16667L4.16667 10M10 4.16667L15.8333 10"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function NewChatScreen() {
  const { fonts } = useTheme();
  const [inputText, setInputText] = useState('');

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;

    // Navigate to AI chat with initial message
    router.replace({
      pathname: '/chat/ai/[id]',
      params: {
        id: `ai-${Date.now()}`,
        initialMessage: inputText.trim(),
      },
    });
  }, [inputText]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp(8),
      height: hp(44),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
      backgroundColor: '#FFFFFF',
    },
    backButton: {
      position: 'absolute',
      left: wp(8),
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    headerTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
      lineHeight: fp(20),
    },
    content: {
      flex: 1,
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(33, 33, 33, 0.05)',
      backgroundColor: '#FFFFFF',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: wp(16),
      paddingVertical: hp(10),
      gap: wp(8),
    },
    textInputContainer: {
      flex: 1,
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      borderRadius: sp(20),
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
      justifyContent: 'center',
      minHeight: sp(44),
    },
    textInput: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
      padding: 0,
      margin: 0,
    },
    sendButton: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(99),
      backgroundColor: '#212121',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: 'rgba(33, 33, 33, 0.2)',
    },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#212121" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <AISparkle size={20} color="#9747FF" />
            <Text style={styles.headerTitle}>New Chat</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Empty content area */}
          <View style={styles.content} />

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask anything..."
                  placeholderTextColor="rgba(33, 33, 33, 0.5)"
                  multiline
                  returnKeyType="default"
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !inputText.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <ArrowUpIcon />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
