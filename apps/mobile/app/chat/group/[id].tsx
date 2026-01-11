import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, ScrollView, Linking, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatBubble, QuotedMessage } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { BackArrow, Users } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';

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
    profile_image_url?: string;
  }>;
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
  whatsapp_phone?: string;
  telegram_username?: string;
}

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

// Lock Icon (for Reply Privately)
function LockIcon({ size = 24, color = "#212121" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 1110 0v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// User Icon (for Message User)
function UserIcon({ size = 24, color = "#212121" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fonts } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<QuotedMessage | null>(null);
  const flashListRef = useRef<FlashList<Message & { showSender: boolean }>>(null);
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

  const loadMemberProfile = async (memberId: string) => {
    try {
      setLoadingProfile(true);
      const response = await api.get(`/chat/groups/${id}/members/${memberId}`);
      if (response.data) {
        setSelectedMember(response.data);
        setShowMembersModal(false);
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Error loading member profile:', error);
      Alert.alert('Error', 'Failed to load member profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleStartChat = async () => {
    if (!selectedMember) return;

    // Check if user is trying to chat with themselves
    if (selectedMember.id === currentUserId.current) {
      Alert.alert('Info', 'You cannot start a conversation with yourself.');
      return;
    }

    try {
      // Create or find an existing direct conversation with this user
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: selectedMember.id,
      });

      if (response.data?.id) {
        setShowProfileModal(false);
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: response.data.id,
            name: selectedMember.name
          },
        } as any);
      }
    } catch (error: any) {
      console.error('Error creating direct conversation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to start conversation. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!selectedMember?.whatsapp_phone) {
      Alert.alert('Not Available', 'This user has not set up their WhatsApp number');
      return;
    }
    // Clean phone number (remove spaces, dashes, etc)
    const phone = selectedMember.whatsapp_phone.replace(/[^0-9+]/g, '');
    const url = `whatsapp://send?phone=${phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on your device');
    });
  };

  const handleOpenTelegram = () => {
    if (!selectedMember?.telegram_username) {
      Alert.alert('Not Available', 'This user has not set up their Telegram username');
      return;
    }
    // Remove @ if present
    const username = selectedMember.telegram_username.replace('@', '');
    const url = `tg://resolve?domain=${username}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Telegram is not installed on your device');
    });
  };

  const handleSend = async () => {
    if (inputText.trim().length === 0 || isSending) return;

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
      const response = await api.post(`/chat/groups/${id}/messages`, {
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

  const handleReplyPrivately = async () => {
    if (!selectedMessage || selectedMessage.sender_id === currentUserId.current) {
      setShowMessageOptions(false);
      setSelectedMessage(null);
      return;
    }

    try {
      // Create or find an existing direct conversation with this user
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: selectedMessage.sender_id,
      });

      if (response.data?.id) {
        // Set up reply in the 1:1 chat
        setShowMessageOptions(false);
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: response.data.id,
            name: selectedMessage.sender_name,
            replyToId: selectedMessage.id,
            replyToContent: selectedMessage.content,
            replyToSenderName: selectedMessage.sender_name,
            replyToSenderId: selectedMessage.sender_id,
          },
        } as any);
      }
    } catch (error: any) {
      console.error('Error creating direct conversation:', error);
      Alert.alert('Error', 'Failed to start private conversation. Please try again.');
    }
    setSelectedMessage(null);
  };

  const handleMessageUser = async () => {
    if (!selectedMessage || selectedMessage.sender_id === currentUserId.current) {
      setShowMessageOptions(false);
      setSelectedMessage(null);
      return;
    }

    try {
      // Create or find an existing direct conversation with this user
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: selectedMessage.sender_id,
      });

      if (response.data?.id) {
        setShowMessageOptions(false);
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: response.data.id,
            name: selectedMessage.sender_name,
          },
        } as any);
      }
    } catch (error: any) {
      console.error('Error creating direct conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
    setSelectedMessage(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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
        showSender={item.showSender}
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    profileModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sp(20),
      borderTopRightRadius: sp(20),
      maxHeight: '70%',
      paddingBottom: hp(34),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: wp(20),
      paddingVertical: hp(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    modalCloseButton: {
      padding: sp(4),
    },
    membersList: {
      paddingHorizontal: wp(20),
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    memberAvatar: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: wp(12),
    },
    memberAvatarImage: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      marginRight: wp(12),
    },
    memberAvatarText: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    memberRole: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    // Profile Modal styles
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
    // Message options modal styles
    messageOptionsContent: {
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

          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => setShowMembersModal(true)}
          >
            <Users size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
          />
        </KeyboardAvoidingView>

        {/* Members Modal */}
        <Modal
          visible={showMembersModal}
          animationType="none"
          transparent={true}
          onRequestClose={() => setShowMembersModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowMembersModal(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Group Members</Text>
                <TouchableOpacity
                  onPress={() => setShowMembersModal(false)}
                  style={styles.modalCloseButton}
                >
                  <CloseIcon size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.membersList}>
                {group?.members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberItem}
                    onPress={() => loadMemberProfile(member.id)}
                    disabled={loadingProfile}
                  >
                    {member.profile_image_url ? (
                      <Image
                        source={{ uri: member.profile_image_url }}
                        style={styles.memberAvatarImage}
                      />
                    ) : (
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                    {loadingProfile && (
                      <ActivityIndicator size="small" color={colors.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Member Profile Modal */}
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
                {selectedMember?.profile_image_url ? (
                  <Image
                    source={{ uri: selectedMember.profile_image_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileImageText}>
                      {selectedMember?.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Name */}
              <Text style={styles.profileName}>{selectedMember?.name}</Text>
              <Text style={styles.profileRole}>{selectedMember?.role}</Text>

              {/* Contact Buttons */}
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={handleStartChat}
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
            </Pressable>
          </Pressable>
        </Modal>

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
            <Pressable style={styles.messageOptionsContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />

              {/* Reply option - always available */}
              <TouchableOpacity style={styles.modalOption} onPress={handleReply}>
                <ReplyIcon size={sp(24)} color={colors.text} />
                <Text style={styles.modalOptionText}>Reply</Text>
              </TouchableOpacity>

              {/* Reply privately - only for messages from other users */}
              {selectedMessage && selectedMessage.sender_id !== currentUserId.current && (
                <>
                  <TouchableOpacity style={styles.modalOption} onPress={handleReplyPrivately}>
                    <LockIcon size={sp(24)} color={colors.text} />
                    <Text style={styles.modalOptionText}>Reply privately</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalOption} onPress={handleMessageUser}>
                    <UserIcon size={sp(24)} color={colors.text} />
                    <Text style={styles.modalOptionText}>Message {selectedMessage.sender_name}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}
