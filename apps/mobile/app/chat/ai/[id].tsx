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
import { ChevronLeft, AISparkle, Image } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

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
}

interface FormattedTextPart {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export default function AIChatScreen() {
  const { id, initialMessage, title: passedTitle } = useLocalSearchParams<{
    id: string;
    initialMessage?: string;
    title?: string;
  }>();
  const { fonts } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationTitle, setConversationTitle] = useState(passedTitle || 'New Chat');
  const scrollViewRef = useRef<ScrollView>(null);
  const hasInitialized = useRef(false);

  // Handle initial message from new chat
  useEffect(() => {
    if (initialMessage && !hasInitialized.current) {
      hasInitialized.current = true;
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

      // Save chat to storage
      saveChat(initialMessage);

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: generateMockResponse(initialMessage),
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setIsLoading(false);
      }, 2000);
    }
  }, [initialMessage]);

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

  const saveChat = async (title: string) => {
    try {
      const savedChats = await AsyncStorage.getItem('ai_chats');
      const chats = savedChats ? JSON.parse(savedChats) : [];
      const newChat = {
        id,
        title,
        createdAt: new Date().toISOString(),
      };
      chats.unshift(newChat);
      await AsyncStorage.setItem('ai_chats', JSON.stringify(chats.slice(0, 50)));
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(userMessage.content),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 2000);
  }, [inputText, isLoading]);

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      borderRadius: sp(99),
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
      justifyContent: 'center',
    },
    textInput: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
      padding: 0,
      margin: 0,
    },
    imagePreview: {
      width: wp(200),
      height: wp(150),
      borderRadius: sp(12),
      marginBottom: hp(8),
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
                  onSubmitEditing={handleSend}
                  editable={!isLoading}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
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

In short: *limited supply + massive hype + discontinuation* = price explosion.`;
  }

  if (lowerMessage.includes('rolex') || lowerMessage.includes('submariner')) {
    return `The Rolex Submariner is one of the most iconic dive watches in history. Here's what you should know:

**Market Overview:**

1. **Current pricing:** Pre-owned models range from €8,000 to €15,000 depending on condition and year.
2. **Availability:** Still very limited at authorized dealers, often requiring waitlists.
3. **Investment potential:** Historically strong value retention, especially for vintage references.

Would you like me to provide more specific pricing data or compare different references?`;
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

What specific aspect would you like me to elaborate on?`;
}
