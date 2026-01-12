import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, AISparkle } from '@/components/icons';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';
import { wp, hp, sp, fp } from '@/utils/responsive';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/services/api';

// Photo icon for image picker (matches Figma)
function PhotoIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M14.25 2.25H3.75C2.92157 2.25 2.25 2.92157 2.25 3.75V14.25C2.25 15.0784 2.92157 15.75 3.75 15.75H14.25C15.0784 15.75 15.75 15.0784 15.75 14.25V3.75C15.75 2.92157 15.0784 2.25 14.25 2.25Z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.375 7.5C7.00178 7.5 7.5 7.00178 7.5 6.375C7.5 5.74822 7.00178 5.25 6.375 5.25C5.74822 5.25 5.25 5.74822 5.25 6.375C5.25 7.00178 5.74822 7.5 6.375 7.5Z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.75 11.25L12 7.5L3.75 15.75"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  imageUri?: string;
  quickReplies?: string[];
}

interface FormattedTextPart {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

// Send button icon (up arrow in circle)
function SendIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 15V5M10 5L5 10M10 5L15 10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AIChatScreen() {
  const { id, initialMessage, title: passedTitle, skipLoad } = useLocalSearchParams<{
    id: string;
    initialMessage?: string;
    title?: string;
    skipLoad?: string;
  }>();
  const { fonts } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationTitle, setConversationTitle] = useState(passedTitle || 'New Chat');
  const [isLoadingHistory, setIsLoadingHistory] = useState(id !== 'new');
  const [chatId, setChatId] = useState<string | null>(id === 'new' ? null : id);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasInitialized = useRef(false);
  const previousIdRef = useRef(id);
  // Use a ref to track chatId for immediate access in callbacks (avoids stale closures)
  const chatIdRef = useRef<string | null>(id === 'new' ? null : id);
  // Track if initial message has been processed (use ref to persist across renders)
  const initialMessageProcessed = useRef(false);

  // Sync chatId with id param when navigating to a different chat
  // Only reset if we're actually navigating to a different chat (not on re-renders)
  useEffect(() => {
    // Skip if the id hasn't actually changed (prevents unwanted resets)
    if (previousIdRef.current === id) {
      return;
    }

    // Skip if we already have a chatId and the new id is 'new'
    // (this means we're re-navigating to the same new chat flow somehow)
    if (chatIdRef.current && id === 'new') {
      return;
    }

    // Skip if the chatIdRef already matches the new id
    // (this means we already processed this ID internally)
    if (chatIdRef.current === id) {
      previousIdRef.current = id;
      return;
    }

    previousIdRef.current = id;

    if (id !== 'new') {
      setChatId(id);
      chatIdRef.current = id;

      // If we have an initialMessage, don't load history - we're showing the new message
      if (initialMessage) {
        hasInitialized.current = false;
        initialMessageProcessed.current = false;
        setIsLoadingHistory(false);
        setMessages([]);
      } else {
        hasInitialized.current = false; // Reset so we can load new chat history
        setIsLoadingHistory(true);
        setMessages([]);
      }
    } else {
      setChatId(null);
      chatIdRef.current = null;
      hasInitialized.current = false;
      initialMessageProcessed.current = false;
      setIsLoadingHistory(false);
      setMessages([]);
    }
  }, [id, initialMessage]);

  // Load existing messages when opening a chat (not new)
  useEffect(() => {
    // Don't load history if we have an initial message - we'll show that instead
    if (id !== 'new' && chatId && !initialMessage) {
      loadChatHistory();
    }
  }, [chatId, initialMessage]);

  const loadChatHistory = async () => {
    if (!chatId) return;

    try {
      setIsLoadingHistory(true);
      const response = await api.get(`/ai-chats/${chatId}/messages`);
      const messagesData = response.data;

      const messagesWithDates = messagesData.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        isUser: msg.is_user,
        timestamp: new Date(msg.created_at),
      }));
      setMessages(messagesWithDates);

      // Set title from first message if not passed
      const firstUserMessage = messagesWithDates.find((m: Message) => m.isUser);
      if (firstUserMessage && !passedTitle) {
        const title = firstUserMessage.content.slice(0, 25);
        setConversationTitle(title + (firstUserMessage.content.length > 25 ? '...' : ''));
      }

      hasInitialized.current = true;

      // Scroll to bottom after loading
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle initial message from new chat (chat is already created in new.tsx)
  useEffect(() => {
    const processInitialMessage = async () => {
      // Only process if we have an initial message and haven't processed it yet
      if (!initialMessage || initialMessageProcessed.current || isLoadingHistory) {
        return;
      }

      // Skip if id is 'new' - this shouldn't happen anymore but guard against it
      if (id === 'new') {
        return;
      }

      // Mark as processed immediately to prevent double processing
      initialMessageProcessed.current = true;
      hasInitialized.current = true;

      // Show user message immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        content: initialMessage,
        isUser: true,
        timestamp: new Date(),
      };
      setMessages([userMessage]);
      setConversationTitle(
        initialMessage.slice(0, 25) + (initialMessage.length > 25 ? '...' : '')
      );
      setIsLoading(true);

      // Chat is already created in new.tsx, so just call the AI assistant API
      try {
        const currentChatId = chatIdRef.current || id;

        // Call the AI assistant API
        const response = await api.post('/assistant/query', {
          message: initialMessage,
        });

        const data = response.data;
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: data.suggested_response,
          isUser: false,
          timestamp: new Date(),
          quickReplies: data.requires_clarification ? data.clarification_options : undefined,
        };
        setMessages((prev) => [...prev, aiResponse]);

        // Save AI response to backend
        await api.post(`/ai-chats/${currentChatId}/messages`, {
          content: data.suggested_response,
          is_ai: true,
        });
      } catch (error) {
        console.error('Error calling assistant API:', error);
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: generateMockResponse(initialMessage),
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      } finally {
        setIsLoading(false);
      }
    };

    processInitialMessage();
  }, [initialMessage, isLoadingHistory, id]);

  // Extract title from first user message
  useEffect(() => {
    if (!passedTitle && messages.length > 0) {
      const firstUserMessage = messages.find((m) => m.isUser);
      if (firstUserMessage) {
        const title = firstUserMessage.content.slice(0, 25);
        setConversationTitle(title + (firstUserMessage.content.length > 25 ? '...' : ''));
      }
    }
  }, [messages, passedTitle]);

  const handleSend = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputText.trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Use ref for immediate access (avoids stale closure issues)
      let currentChatId: string = chatIdRef.current || '';

      // If no chat exists yet, create one first
      if (!currentChatId) {
        const createResponse = await api.post('/ai-chats', {
          title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
          initial_message: content,
        });
        currentChatId = createResponse.data.id;
        setChatId(currentChatId);
        chatIdRef.current = currentChatId; // Update ref immediately
        previousIdRef.current = currentChatId; // Update previous ID ref
        // Note: We intentionally don't update the URL here to avoid navigation issues
        // The chatIdRef is used for all subsequent API calls
      } else {
        // Save user message to backend
        await api.post(`/ai-chats/${currentChatId}/messages`, {
          content,
          is_ai: false,
        });
      }

      // Build conversation history from messages state (need fresh reference)
      const conversationHistory = messages.map(msg => ({
        content: msg.content,
        is_user: msg.isUser,
      }));

      // Call the AI assistant API with conversation history for context
      const response = await api.post('/assistant/query', {
        message: content,
        conversation_history: conversationHistory,
      });

      const data = response.data;
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.suggested_response,
        isUser: false,
        timestamp: new Date(),
        quickReplies: data.requires_clarification ? data.clarification_options : undefined,
      };
      setMessages((prev) => [...prev, aiResponse]);

      // Save AI response to backend
      await api.post(`/ai-chats/${currentChatId}/messages`, {
        content: data.suggested_response,
        is_ai: true,
      });
    } catch (error) {
      console.error('Error calling assistant API:', error);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(content),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [inputText, isLoading]);

  const handleQuickReply = useCallback((reply: string) => {
    // Remove quick replies from the last message
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && !lastMessage.isUser && lastMessage.quickReplies) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, quickReplies: undefined },
        ];
      }
      return prev;
    });
    // Send the quick reply as a message
    handleSend(reply);
  }, [handleSend]);

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const imageMessage: Message = {
        id: Date.now().toString(),
        content: 'Analyze this image',
        isUser: true,
        timestamp: new Date(),
        imageUri: result.assets[0].uri,
      };

      setMessages((prev) => [...prev, imageMessage]);
      setIsLoading(true);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Simulate AI response for image
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content:
            "I can see the watch in your image. Based on the design elements, dial layout, and case shape, this appears to be a luxury timepiece. Let me provide you with more details about what I observe:\n\n**Visual Analysis:**\n\n1. **Case:** The case appears to be stainless steel with polished finishing\n2. **Dial:** Features a clean, minimalist design\n3. **Bracelet:** Integrated bracelet design\n\nWould you like me to help identify the specific model or provide market value information?",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 3000);
    }
  };

  // Parse and render formatted text (bold, italic, numbered lists)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Check for numbered list items with bold text
      const listMatch = line.match(/^(\d+)\.\s+\*\*(.+?):?\*\*:?\s*(.*)$/);
      if (listMatch) {
        const [, number, boldText, rest] = listMatch;
        elements.push(
          <View key={lineIndex} style={styles.listItem}>
            <Text style={[styles.aiText, { fontFamily: fonts.regular }]}>
              {number}.{' '}
              <Text style={{ fontFamily: fonts.bold }}>{boldText}</Text>
              {rest ? `: ${rest}` : ''}
            </Text>
          </View>
        );
        return;
      }

      // Check for bold headers (lines that are just **text**)
      const boldHeaderMatch = line.match(/^\*\*(.+?)\*\*$/);
      if (boldHeaderMatch) {
        elements.push(
          <Text
            key={lineIndex}
            style={[styles.aiText, { fontFamily: fonts.bold, marginTop: hp(8) }]}
          >
            {boldHeaderMatch[1]}
          </Text>
        );
        return;
      }

      // Process inline formatting
      const parts = parseInlineFormatting(line);
      if (parts.length > 0 || line === '') {
        elements.push(
          <Text key={lineIndex} style={[styles.aiText, { fontFamily: fonts.regular }]}>
            {parts.map((part, partIndex) => {
              if (part.bold) {
                return (
                  <Text key={partIndex} style={{ fontFamily: fonts.bold }}>
                    {part.text}
                  </Text>
                );
              }
              if (part.italic) {
                return (
                  <Text key={partIndex} style={{ fontStyle: 'italic' }}>
                    {part.text}
                  </Text>
                );
              }
              return part.text;
            })}
            {lineIndex < lines.length - 1 ? '\n' : ''}
          </Text>
        );
      }
    });

    return elements;
  };

  const parseInlineFormatting = (text: string): FormattedTextPart[] => {
    const parts: FormattedTextPart[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/\*([^*]+)\*/);

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
        if (boldMatch.index! > 0) {
          parts.push({ text: remaining.slice(0, boldMatch.index) });
        }
        parts.push({ text: boldMatch[1], bold: true });
        remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
      } else if (italicMatch) {
        if (italicMatch.index! > 0) {
          parts.push({ text: remaining.slice(0, italicMatch.index) });
        }
        parts.push({ text: italicMatch[1], italic: true });
        remaining = remaining.slice(italicMatch.index! + italicMatch[0].length);
      } else {
        parts.push({ text: remaining });
        break;
      }
    }

    return parts;
  };

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
      maxWidth: wp(280),
    },
    headerTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
      lineHeight: fp(20),
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
      gap: hp(32),
    },
    messageRow: {
      width: '100%',
    },
    userMessageContainer: {
      alignItems: 'flex-end',
    },
    aiMessageContainer: {
      alignItems: 'flex-start',
    },
    userBubble: {
      backgroundColor: '#F6F6F6',
      paddingHorizontal: wp(16),
      paddingVertical: hp(8),
      borderRadius: sp(12),
      maxWidth: wp(250),
    },
    userText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
    },
    aiMessageContent: {
      paddingVertical: hp(8),
      width: '100%',
    },
    aiText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
    },
    listItem: {
      marginBottom: hp(8),
      marginLeft: wp(4),
    },
    loadingContainer: {
      alignItems: 'flex-start',
      paddingVertical: hp(8),
    },
    loadingText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      opacity: 0.6,
      lineHeight: fp(20),
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(33, 33, 33, 0.05)',
      backgroundColor: '#FFFFFF',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      height: hp(64),
      gap: wp(8),
    },
    imageButton: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(99),
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    textInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      borderRadius: sp(99),
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
    },
    textInput: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.medium,
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
      marginLeft: wp(8),
    },
    sendButtonDisabled: {
      opacity: 0.3,
    },
    imagePreview: {
      width: wp(200),
      height: wp(150),
      borderRadius: sp(12),
      marginBottom: hp(8),
    },
    quickRepliesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(8),
      marginTop: hp(12),
    },
    quickReplyButton: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(10),
      borderRadius: sp(20),
      backgroundColor: '#F6F6F6',
      borderWidth: 1,
      borderColor: '#212121',
    },
    quickReplyText: {
      fontSize: fp(14),
      fontFamily: fonts.medium,
      color: '#212121',
      letterSpacing: 0.07,
    },
  });

  return (
    <SubscriptionOverlay feature="ai_chat" showBackButton>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#212121" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <AISparkle size={20} color="#9747FF" />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversationTitle}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.isUser ? styles.userMessageContainer : styles.aiMessageContainer,
                ]}
              >
                {message.isUser ? (
                  <View style={styles.userBubble}>
                    {message.imageUri && (
                      <RNImage source={{ uri: message.imageUri }} style={styles.imagePreview} />
                    )}
                    <Text style={styles.userText}>{message.content}</Text>
                  </View>
                ) : (
                  <View style={styles.aiMessageContent}>
                    {renderFormattedText(message.content)}
                    {message.quickReplies && message.quickReplies.length > 0 && (
                      <View style={styles.quickRepliesContainer}>
                        {message.quickReplies.map((reply, index) => (
                          <TouchableOpacity
                            key={index}
                            style={styles.quickReplyButton}
                            onPress={() => handleQuickReply(reply)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.quickReplyText}>{reply}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <View style={[styles.messageRow, styles.aiMessageContainer]}>
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>One sec please...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
                <PhotoIcon />
              </TouchableOpacity>
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask anything..."
                  placeholderTextColor="rgba(33, 33, 33, 0.5)"
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={() => handleSend()}
                  editable={!isLoading}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                onPress={() => handleSend()}
                disabled={!inputText.trim() || isLoading}
              >
                <SendIcon />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SubscriptionOverlay>
  );
}

// Mock response generator for demo
function generateMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('nautilus') || lowerMessage.includes('5711')) {
    return `Here's the short version:

**Why the Patek Philippe Nautilus 5711 spiked in price**

1. **Discontinuation:** Patek officially stopped producing the steel 5711 in 2021, making existing pieces instantly rarer.
2. **Extreme scarcity:** Even before that, demand far exceeded supply — long waitlists and limited production.
3. **Hype & status:** Celebrity ownership, social media buzz, and its reputation as the luxury steel sports watch fueled desire.
4. **Speculation:** Collectors and investors treated it like an asset, driving up resale values.
5. **Brand strategy:** Patek replaced it with the costlier gold 5811, reinforcing the 5711's exclusivity.

In short: *limited supply + massive hype + discontinuation* = price explosion.

Would you like me to add this watch to your watchlist so you can track price changes?`;
  }

  if (lowerMessage.includes('rolex') || lowerMessage.includes('submariner')) {
    return `The Rolex Submariner is one of the most iconic dive watches in history. Here's what you should know:

**Market Overview:**

1. **Current pricing:** Pre-owned models range from €8,000 to €15,000 depending on condition and year.
2. **Availability:** Still very limited at authorized dealers, often requiring waitlists.
3. **Investment potential:** Historically strong value retention, especially for vintage references.

Would you like me to add this watch to your watchlist to track market prices?`;
  }

  if (lowerMessage.includes('reference') || lowerMessage.includes('number')) {
    return `Based on the information provided, I can help identify watch references. Here are some common Patek Philippe Nautilus references:

**Nautilus Reference Numbers:**

1. **5711/1A:** The classic steel blue dial version
2. **5711/1R:** Rose gold version
3. **5712/1A:** Moonphase complication variant
4. **5726/1A:** Annual calendar variant
5. **5980/1A:** Chronograph version

Could you share more details or an image of the specific watch you're asking about?`;
  }

  return `Thank you for your question about "${userMessage}".

I'd be happy to help you with information about luxury watches. Here's what I can assist with:

**My capabilities:**

1. **Market analysis:** Current pricing trends and market values
2. **Authentication tips:** How to verify authenticity
3. **Investment advice:** Which models hold value best
4. **Buying guidance:** Where and how to purchase safely

What specific aspect would you like me to elaborate on?

Would you like me to add any watches to your watchlist for tracking?`;
}
