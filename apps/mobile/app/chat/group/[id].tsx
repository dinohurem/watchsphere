import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { BackArrow, Users } from '@/components/icons';
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

interface GroupDetails {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fonts } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flashListRef = useRef<FlashList<Message>>(null);
  const currentUserId = useRef<string>('');

  useEffect(() => {
    if (id) {
      loadGroupDetails();
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

  const loadGroupDetails = async () => {
    try {
      const response = await api.get(`/chat/groups/${id}`);
      if (response.data) {
        setGroup(response.data);
      }
    } catch (error) {
      console.error('Error loading group details:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/chat/groups/${id}/messages`);
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
      const response = await api.post(`/chat/groups/${id}/messages`, {
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

  // Group consecutive messages from same sender
  const groupedMessages = messages.map((msg, index) => {
    const prevMsg = messages[index - 1];
    const showSender = msg.sender_id !== currentUserId.current &&
      (!prevMsg || prevMsg.sender_id !== msg.sender_id);

    return { ...msg, showSender };
  });

  const renderMessage = ({ item }: { item: Message & { showSender: boolean } }) => {
    const isUser = item.sender_id === currentUserId.current;

    return (
      <ChatBubble
        message={item.content}
        isUser={isUser}
        timestamp={formatTime(item.created_at)}
        status={item.read ? 'read' : 'sent'}
        senderName={item.sender_name}
        showSender={item.showSender}
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
      borderRadius: 8,
    },
    headerInfo: {
      alignItems: 'flex-start',
    },
    headerName: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    headerRight: {
      width: 40,
      alignItems: 'center',
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
            {group?.avatar ? (
              <Image source={{ uri: group.avatar }} style={styles.headerAvatar} />
            ) : (
              <ImagePlaceholder size={36} borderRadius={8} />
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{group?.name || 'Group Chat'}</Text>
              <Text style={styles.headerSubtitle}>
                {group?.memberCount || 0} members
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Users size={20} color={colors.textSecondary} />
          </View>
        </View>

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
          ) : groupedMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptySubtitle}>
                  Be the first to send a message in this group.
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
            />
          )}

          {/* Chat Input */}
          <ChatInput
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            onImageSelect={(uri) => console.log('Image selected:', uri)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
