import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { FlashList } from '@shopify/flash-list';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatBubble, QuotedMessage } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { BackArrow, ChevronRight } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Reply Icon
function ReplyIcon({ size = 24, color = "#212121" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 17l-5-5 5-5M4 12h11a4 4 0 0 1 4 4v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender_name?: string;
  reply_to_sender_id?: string;
}

interface ConversationDetails {
  id: string;
  name: string;
  avatar?: string;
}

interface WatchInfo {
  id: string;
  brand: string;
  model: string;
  price: number;
  imageUrl?: string;
}

export default function ChatDetailScreen() {
  const { id, name, avatar, watchId, watchBrand, watchModel, watchPrice, watchImageUrl, replyToId, replyToContent, replyToSenderName, replyToSenderId } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    watchId?: string;
    watchBrand?: string;
    watchModel?: string;
    watchPrice?: string;
    watchImageUrl?: string;
    replyToId?: string;
    replyToContent?: string;
    replyToSenderName?: string;
    replyToSenderId?: string;
  }>();
  const { colors, fonts } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [watchInfo, setWatchInfo] = useState<WatchInfo | null>(null);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<QuotedMessage | null>(null);
  const flashListRef = useRef<FlashList<Message>>(null);
  const currentUserId = useRef<string>('');

  // Check if this is a new/demo conversation
  const isNewConversation = id === 'new';

  useEffect(() => {
    if (id) {
      // Set conversation from params if available (temporary, will be updated by API)
      if (name) {
        setConversation({ id, name, avatar: avatar || undefined });
      }
      // Set watch info from params if available
      if (watchId && watchBrand && watchModel && watchPrice) {
        setWatchInfo({
          id: watchId,
          brand: watchBrand,
          model: watchModel,
          price: parseFloat(watchPrice),
          imageUrl: watchImageUrl || undefined,
        });
      }
      // Set reply if coming from group chat "Reply privately"
      if (replyToId && replyToContent && replyToSenderName && replyToSenderId) {
        setReplyingTo({
          id: replyToId,
          content: replyToContent,
          senderName: replyToSenderName,
          senderId: replyToSenderId,
        });
      }
      // Only load messages if this is a real conversation (not 'new')
      if (!isNewConversation) {
        loadMessages();
        loadConversationDetails();
      } else {
        setIsLoading(false);
      }
      loadCurrentUser();
    }
  }, [id]);

  const loadConversationDetails = async () => {
    try {
      const response = await api.get(`/chat/conversations/${id}`);
      if (response.data) {
        setConversation({
          id: response.data.id,
          name: response.data.name,
          avatar: response.data.avatar || undefined,
        });
      }
    } catch (error) {
      console.error('Error loading conversation details:', error);
      // Keep using params if API fails
    }
  };

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

    // For demo/new conversations, just show the message locally
    if (isNewConversation) {
      const messageContent = inputText.trim();
      setInputText('');
      const demoMessage: Message = {
        id: `demo-${Date.now()}`,
        conversation_id: 'new',
        sender_id: currentUserId.current || 'user',
        sender_name: 'You',
        content: messageContent,
        type: 'text',
        is_ai: false,
        read: true,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, demoMessage]);
      return;
    }

    const messageContent = inputText.trim();
    const currentReply = replyingTo;
    setInputText('');
    setReplyingTo(null);
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
      reply_to_id: currentReply?.id,
      reply_to_content: currentReply?.content,
      reply_to_sender_name: currentReply?.senderName,
      reply_to_sender_id: currentReply?.senderId,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await api.post(`/chat/conversations/${id}/messages`, {
        content: messageContent,
        reply_to_id: currentReply?.id,
      });

      if (response.data) {
        // Replace temp message with real one, preserving reply info if not returned by API
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessage.id ? {
              ...response.data,
              reply_to_id: response.data.reply_to_id || tempMessage.reply_to_id,
              reply_to_content: response.data.reply_to_content || tempMessage.reply_to_content,
              reply_to_sender_name: response.data.reply_to_sender_name || tempMessage.reply_to_sender_name,
              reply_to_sender_id: response.data.reply_to_sender_id || tempMessage.reply_to_sender_id,
            } : msg
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

  const handleMessageLongPress = (message: Message) => {
    setSelectedMessage(message);
    setShowMessageOptions(true);
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyingTo({
        id: selectedMessage.id,
        content: selectedMessage.content,
        senderName: selectedMessage.sender_name,
        senderId: selectedMessage.sender_id,
      });
    }
    setShowMessageOptions(false);
    setSelectedMessage(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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

    // Build quoted message if this is a reply
    const quotedMessage: QuotedMessage | undefined = item.reply_to_id
      ? {
          id: item.reply_to_id,
          content: item.reply_to_content || '',
          senderName: item.reply_to_sender_name || 'Unknown',
          senderId: item.reply_to_sender_id || '',
        }
      : undefined;

    return (
      <ChatBubble
        message={item.content}
        isUser={isUser}
        timestamp={formatTime(item.created_at)}
        status={item.read ? 'read' : 'sent'}
        senderName={item.sender_name}
        showSender={false}
        isAI={false}
        messageId={item.id}
        senderId={item.sender_id}
        quotedMessage={quotedMessage}
        onLongPress={() => handleMessageLongPress(item)}
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
    watchInfoSection: {
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
    // Message options modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sp(20),
      borderTopRightRadius: sp(20),
      paddingTop: hp(8),
      paddingBottom: hp(34),
    },
    modalHandle: {
      width: sp(36),
      height: sp(4),
      backgroundColor: colors.border,
      borderRadius: sp(2),
      alignSelf: 'center',
      marginBottom: hp(16),
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(14),
      paddingHorizontal: wp(20),
      gap: wp(16),
    },
    modalOptionText: {
      fontSize: fp(16),
      fontFamily: fonts.medium,
      color: colors.text,
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
        {watchInfo && (
          <TouchableOpacity
            style={styles.watchCard}
            onPress={() => router.push(`/market/${watchInfo.id}` as any)}
          >
            {watchInfo.imageUrl ? (
              <Image source={{ uri: watchInfo.imageUrl }} style={styles.watchImage} />
            ) : (
              <ImagePlaceholder size={60} borderRadius={8} />
            )}
            <View style={styles.watchInfoSection}>
              <Text style={styles.watchTitle}>{watchInfo.brand} {watchInfo.model}</Text>
              <Text style={styles.watchPrice}>€{watchInfo.price.toLocaleString()}</Text>
            </View>
            <View style={styles.watchChevron}>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

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
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
          />
        </KeyboardAvoidingView>

        {/* Message Options Modal */}
        <Modal
          visible={showMessageOptions}
          animationType="none"
          transparent={true}
          onRequestClose={() => setShowMessageOptions(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowMessageOptions(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />

              <TouchableOpacity style={styles.modalOption} onPress={handleReply}>
                <ReplyIcon size={sp(24)} color={colors.text} />
                <Text style={styles.modalOptionText}>Reply</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}
