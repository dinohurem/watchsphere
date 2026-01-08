import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { BackArrow, ChevronRight } from '@/components/icons';
import { api } from '@/services/api';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  type: string;
  is_ai: boolean;
  read: boolean;
  created_at: string;
}

interface ConversationDetails {
  id: string;
  name: string;
  avatar?: string;
}

export default function ChatDetailScreen() {
  const { id, name, avatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const { colors, fonts } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flashListRef = useRef<FlashList<Message>>(null);
  const currentUserId = useRef<string>('');

  useEffect(() => {
    if (id) {
      // Set conversation from params if available
      if (name) {
        setConversation({ id, name, avatar: avatar || undefined });
      }
      loadMessages();
      loadCurrentUser();
    }
  }, [id]);

  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/profile/me');
      if (response.data) {
        currentUserId.current = response.data.id;
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/chat/conversations/${id}/messages`);
      if (response.data) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (inputText.trim().length === 0 || isSending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      sender_id: currentUserId.current,
      sender_name: 'You',
      content: messageContent,
      type: 'text',
      is_ai: false,
      read: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await api.post(`/chat/conversations/${id}/messages`, {
        content: messageContent,
      });

      if (response.data) {
        // Replace temp message with real one
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessage.id ? response.data : msg
          )
        );
      }

      // Scroll to bottom
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = async (uri: string) => {
    // TODO: Implement image upload and send
    console.log('Image selected:', uri);
  };

  const formatTime = (dateStr: string) => {
    const now = new Date();
    const messageDate = new Date(dateStr);

    const isToday = now.toDateString() === messageDate.toDateString();

    if (isToday) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender_id === currentUserId.current;

    return (
      <ChatBubble
        message={item.content}
        isUser={isUser}
        timestamp={formatTime(item.created_at)}
        status={item.read ? 'read' : 'sent'}
        senderName={item.sender_name}
        showSender={false}
        isAI={false}
      />
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
      width: 40,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    headerName: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    headerRight: {
      width: 40,
    },
    messagesContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyCard: {
      backgroundColor: colors.backgroundSecondary,
      paddingVertical: 20,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    watchCard: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundSecondary,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      gap: 12,
    },
    watchImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    watchInfo: {
      flex: 1,
      justifyContent: 'center',
      gap: 4,
    },
    watchTitle: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    watchPrice: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    watchChevron: {
      justifyContent: 'center',
    },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <BackArrow size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {conversation?.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {conversation?.name?.charAt(0).toUpperCase() || 'C'}
                </Text>
              </View>
            )}
            <Text style={styles.headerName}>{conversation?.name || name || 'Chat'}</Text>
          </View>

          <View style={styles.headerRight} />
        </View>

        {/* Watch Card - Only shown for direct chats about watches */}
        <TouchableOpacity style={styles.watchCard} onPress={() => router.push('/watch/1' as any)}>
          <ImagePlaceholder size={60} borderRadius={8} />
          <View style={styles.watchInfo}>
            <Text style={styles.watchTitle}>Audemars Piguet Royal Oak</Text>
            <Text style={styles.watchPrice}>€132,352</Text>
          </View>
          <View style={styles.watchChevron}>
            <ChevronRight size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Messages List */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptySubtitle}>
                  Ask about pricing, availability, or condition.
                </Text>
              </View>
            </View>
          ) : (
            <FlashList
              ref={flashListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              estimatedItemSize={80}
              contentContainerStyle={{ paddingVertical: 8 }}
              inverted={false}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Chat Input */}
          <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            onImageSelect={handleImageSelect}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
