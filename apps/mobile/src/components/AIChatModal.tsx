import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { X, Send, Image, Zap } from './icons';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AIChatModal({ visible, onClose }: AIChatModalProps) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const sendButtonScale = useRef(new Animated.Value(0)).current;
  const imageButtonWidth = useRef(new Animated.Value(44)).current;

  useEffect(() => {
    // Animate send button and image button
    Animated.parallel([
      Animated.spring(sendButtonScale, {
        toValue: inputText.trim().length > 0 ? 1 : 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(imageButtonWidth, {
        toValue: inputText.trim().length > 0 ? 0 : 44,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [inputText]);

  const handleSend = () => {
    if (inputText.trim()) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        isUser: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText('');

      // Simulate AI response (in production, this would call an API)
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'I understand your question. Let me help you with that.',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }, 1000);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.aiIconContainer, { backgroundColor: colors.primaryLight }]}>
                <Zap size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Ask AI</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Always here to help</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            style={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyCard, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Start the conversation</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Ask about pricing, availability, or condition.
                  </Text>
                </View>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageContainer,
                    message.isUser ? styles.userMessageContainer : styles.aiMessageContainer,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.isUser ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: colors.backgroundSecondary }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.isUser ? styles.userMessageText : [styles.aiMessageText, { color: colors.text }],
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Input */}
          <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Animated.View style={{ width: imageButtonWidth, overflow: 'hidden' }}>
              <TouchableOpacity style={styles.imageButton}>
                <Image size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Send message..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
            />
            <Animated.View
              style={{
                transform: [{ scale: sendButtonScale }],
              }}
            >
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.primary }]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Send size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  closeButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyCard: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    gap: 8,
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
