import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { useChat } from '@/contexts/ChatContext';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { ChevronLeft, Phone, Video, MoreVertical, ChevronRight } from '@/components/icons';
import { Message } from '@/services/chatService';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const {
    getConversation,
    getMessages,
    loadMessages,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    loadingMessages,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const flashListRef = useRef<FlashList<Message>>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const conversation = useMemo(() => getConversation(id), [id, getConversation]);
  const messages = useMemo(() => getMessages(id), [id, getMessages]);
  const isLoading = loadingMessages.get(id) ?? false;

  useEffect(() => {
    if (id) {
      loadMessages(id);
    }
  }, [id]);

  useEffect(() => {
    // Mark messages as read when viewing
    if (messages.length > 0) {
      const unreadMessages = messages
        .filter(m => m.status !== 'read' && m.senderId !== 'current_user')
        .map(m => m.id);

      if (unreadMessages.length > 0) {
        markAsRead(id, unreadMessages);
      }
    }
  }, [messages, id]);

  const handleSend = () => {
    if (inputText.trim().length === 0) return;

    sendMessage(id, inputText.trim());
    setInputText('');

    // Scroll to bottom after sending
    setTimeout(() => {
      flashListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTypingStart = () => {
    startTyping(id);
  };

  const handleTypingStop = () => {
    stopTyping(id);
  };

  // Get typing users (excluding current user)
  const typingUsers = useMemo(() => {
    if (!conversation) return [];

    return conversation.participants
      .filter(p => conversation.typing.includes(p.id) && p.id !== 'current_user')
      .map(p => p.name);
  }, [conversation]);

  // Check if we should show sender name (for group chats)
  const shouldShowSender = conversation?.type === 'group';

  // Group consecutive messages from same sender
  const groupedMessages = useMemo(() => {
    const grouped: Array<Message & { showSender: boolean }> = [];

    messages.forEach((msg, index) => {
      const prevMsg = messages[index - 1];
      const showSender = shouldShowSender &&
        msg.senderId !== 'current_user' &&
        (!prevMsg || prevMsg.senderId !== msg.senderId);

      grouped.push({ ...msg, showSender });
    });

    return grouped;
  }, [messages, shouldShowSender]);

  const renderMessage = ({ item }: { item: Message & { showSender: boolean } }) => {
    const isUser = item.senderId === 'current_user';
    const isAI = item.senderId === 'ai_assistant' || id.startsWith('ai');

    return (
      <ChatBubble
        message={item.content}
        isUser={isUser}
        timestamp={formatTime(item.timestamp)}
        status={item.status}
        senderName={item.senderName}
        showSender={item.showSender}
        isAI={isAI}
      />
    );
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);

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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      marginRight: 12,
      padding: 4,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    headerInfo: {
      flex: 1,
    },
    headerName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    headerStatus: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    actionButton: {
      padding: 4,
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
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      fontWeight: '400',
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
      backgroundColor: colors.background,
    },
    watchInfo: {
      flex: 1,
      justifyContent: 'center',
      gap: 4,
    },
    watchTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    watchPrice: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    watchChevron: {
      justifyContent: 'center',
    },
  });

  const getHeaderStatus = () => {
    if (typingUsers.length > 0) {
      if (typingUsers.length === 1) {
        return `${typingUsers[0]} is typing...`;
      } else if (typingUsers.length === 2) {
        return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      } else {
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
      }
    }

    if (conversation?.type === 'group') {
      const onlineCount = conversation.participants.filter(p => p.online).length;
      return `${conversation.participants.length} members, ${onlineCount} online`;
    }

    const participant = conversation?.participants[0];
    return participant?.online ? 'Online' : 'Offline';
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {conversation?.name?.charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{conversation?.name || 'Chat'}</Text>
              <Text style={styles.headerStatus}>{getHeaderStatus()}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {conversation?.type === 'direct' && (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <Phone size={22} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Video size={22} color={colors.text} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.actionButton}>
              <MoreVertical size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Watch Card */}
        <TouchableOpacity style={styles.watchCard} onPress={() => router.push('/watch/1' as any)}>
          <View style={styles.watchImage} />
          <View style={styles.watchInfo}>
            <Text style={styles.watchTitle}>Rolex Submariner Date</Text>
            <Text style={styles.watchPrice}>€12,352</Text>
          </View>
          <View style={styles.watchChevron}>
            <ChevronRight size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Messages List */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : groupedMessages.length === 0 ? (
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
              data={groupedMessages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              estimatedItemSize={80}
              contentContainerStyle={{ paddingVertical: 8 }}
              inverted={false}
              showsVerticalScrollIndicator={false}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                typingUsers.length > 0 ? (
                  <TypingIndicator names={typingUsers} isGroup={conversation?.type === 'group'} />
                ) : null
              }
            />
          )}

          {/* Chat Input */}
          <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
