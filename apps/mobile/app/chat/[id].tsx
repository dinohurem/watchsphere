import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Pressable, Linking, Alert } from 'react-native';
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

// Chat Icon for in-app chat
function ChatIcon({ size = 24, color = "#212121" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// WhatsApp Icon
function WhatsAppIcon({ size = 24, color = "#25D366" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
        fill={color}
      />
    </Svg>
  );
}

// Telegram Icon
function TelegramIcon({ size = 24, color = "#0088CC" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.1.155.234.171.328.015.094.035.309.02.476z"
        fill={color}
      />
    </Svg>
  );
}

// Close Icon
function CloseIcon({ size = 24, color = "#212121" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
  participant_id?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
  whatsapp_phone?: string;
  telegram_username?: string;
}

interface WatchInfo {
  id: string;
  brand: string;
  model: string;
  price: number;
  imageUrl?: string;
}

export default function ChatDetailScreen() {
  const { id, name, avatar, participantId, watchId, watchBrand, watchModel, watchPrice, watchImageUrl, replyToId, replyToContent, replyToSenderName, replyToSenderId } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    participantId?: string;
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const flashListRef = useRef<FlashList<Message>>(null);
  const currentUserId = useRef<string>('');

  // Check if this is a new/demo conversation
  const isNewConversation = id === 'new';

  useEffect(() => {
    if (id) {
      // Set conversation from params if available (temporary, will be updated by API)
      if (name) {
        setConversation({ id, name, avatar: avatar || undefined, participant_id: participantId || undefined });
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
          participant_id: response.data.participant_id || undefined,
        });
      }
    } catch (error) {
      console.error('Error loading conversation details:', error);
      // Keep using params if API fails
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      setLoadingProfile(true);
      const response = await api.get(`/profile/user/${userId}`);
      if (response.data) {
        setUserProfile(response.data);
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!userProfile?.whatsapp_phone) {
      Alert.alert('Not Available', 'This user has not set up their WhatsApp number');
      return;
    }
    const phone = userProfile.whatsapp_phone.replace(/[^0-9+]/g, '');
    const url = `whatsapp://send?phone=${phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on your device');
    });
  };

  const handleOpenTelegram = () => {
    if (!userProfile?.telegram_username) {
      Alert.alert('Not Available', 'This user has not set up their Telegram username');
      return;
    }
    const username = userProfile.telegram_username.replace('@', '');
    const url = `tg://resolve?domain=${username}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Telegram is not installed on your device');
    });
  };

  const handleHeaderPress = () => {
    // Try to get participant ID from conversation, or find it from messages
    let targetUserId = conversation?.participant_id;

    if (!targetUserId && messages.length > 0) {
      // Find the other participant from messages
      const otherUserMessage = messages.find(m => m.sender_id !== currentUserId.current);
      if (otherUserMessage) {
        targetUserId = otherUserMessage.sender_id;
      }
    }

    if (targetUserId && targetUserId !== currentUserId.current) {
      loadUserProfile(targetUserId);
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
    // Profile modal styles
    profileModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    profileModalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sp(20),
      borderTopRightRadius: sp(20),
      paddingHorizontal: wp(24),
      paddingTop: hp(20),
      paddingBottom: hp(40),
      alignItems: 'center',
    },
    profileCloseButton: {
      position: 'absolute',
      top: hp(16),
      right: wp(16),
      padding: sp(4),
      zIndex: 1,
    },
    profileImageContainer: {
      marginTop: hp(20),
      marginBottom: hp(16),
    },
    profileImage: {
      width: sp(100),
      height: sp(100),
      borderRadius: sp(50),
    },
    profileImagePlaceholder: {
      width: sp(100),
      height: sp(100),
      borderRadius: sp(50),
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileImageText: {
      fontSize: fp(36),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    profileName: {
      fontSize: fp(22),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: hp(4),
    },
    profileRole: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textTransform: 'capitalize',
      marginBottom: hp(24),
    },
    contactButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: wp(32),
    },
    contactButton: {
      alignItems: 'center',
    },
    contactIconContainer: {
      width: sp(56),
      height: sp(56),
      borderRadius: sp(28),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(8),
    },
    contactLabel: {
      fontSize: fp(12),
      fontFamily: fonts.medium,
      color: colors.text,
    },
    viewProfileButton: {
      backgroundColor: colors.text,
      borderRadius: sp(999),
      paddingVertical: hp(14),
      paddingHorizontal: wp(24),
      marginTop: hp(16),
      width: '100%',
      alignItems: 'center',
    },
    viewProfileButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.background,
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

          <TouchableOpacity
            style={styles.headerCenter}
            onPress={handleHeaderPress}
            disabled={loadingProfile}
            activeOpacity={0.7}
          >
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
            {loadingProfile && <ActivityIndicator size="small" color={colors.text} />}
          </TouchableOpacity>

          <View style={styles.headerRight} />
        </View>

        {/* Watch Card - Only shown for direct chats about watches */}
        {watchInfo && (
          <TouchableOpacity
            style={styles.watchCard}
            onPress={() => router.push({
              pathname: '/market/watch-details',
              params: {
                orderId: watchInfo.id,
                brand: watchInfo.brand,
                model: watchInfo.model,
                price: watchInfo.price.toString(),
                fromOrderBook: 'true',
              },
            } as any)}
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

        {/* User Profile Modal */}
        <Modal
          visible={showProfileModal}
          animationType="none"
          transparent={true}
          onRequestClose={() => setShowProfileModal(false)}
        >
          <Pressable
            style={styles.profileModalOverlay}
            onPress={() => setShowProfileModal(false)}
          >
            <Pressable style={styles.profileModalContent} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                style={styles.profileCloseButton}
              >
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>

              {/* Profile Image */}
              <View style={styles.profileImageContainer}>
                {userProfile?.profile_image_url ? (
                  <Image
                    source={{ uri: userProfile.profile_image_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileImageText}>
                      {userProfile?.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={styles.profileName}>{userProfile?.name}</Text>
              <Text style={styles.profileRole}>{userProfile?.role}</Text>

              {/* Contact Buttons */}
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => {
                    setShowProfileModal(false);
                    // Already in a chat with this user
                  }}
                >
                  <View style={[styles.contactIconContainer, { backgroundColor: 'rgba(33, 33, 33, 0.1)' }]}>
                    <ChatIcon size={sp(28)} color="#212121" />
                  </View>
                  <Text style={styles.contactLabel}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={handleOpenWhatsApp}
                >
                  <View style={[styles.contactIconContainer, { backgroundColor: 'rgba(37, 211, 102, 0.1)' }]}>
                    <WhatsAppIcon size={sp(28)} />
                  </View>
                  <Text style={styles.contactLabel}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={handleOpenTelegram}
                >
                  <View style={[styles.contactIconContainer, { backgroundColor: 'rgba(0, 136, 204, 0.1)' }]}>
                    <TelegramIcon size={sp(28)} />
                  </View>
                  <Text style={styles.contactLabel}>Telegram</Text>
                </TouchableOpacity>
              </View>

              {/* View Profile Button */}
              <TouchableOpacity
                style={styles.viewProfileButton}
                onPress={() => {
                  setShowProfileModal(false);
                  if (userProfile?.id) {
                    router.push(`/user/${userProfile.id}` as any);
                  }
                }}
              >
                <Text style={styles.viewProfileButtonText}>View Profile</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}
