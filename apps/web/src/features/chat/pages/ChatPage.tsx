import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Image, Send, X, Flag, Users, Reply, MessageSquare, CornerUpRight, MoreVertical, CheckCheck, Trash2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { chatWebSocket, WebSocketMessage } from '@/services/chatWebSocket';
import { useChatStore, useAuthStore } from '@watchsphere/shared/stores';
import { useNotification } from '@/contexts/NotificationContext';

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  customerId?: string;
}

function UserProfileModal({
  user,
  onClose,
  onNavigateToProfile,
  onReport
}: {
  user: UserProfile;
  onClose: () => void;
  onNavigateToProfile: (userId: string) => void;
  onReport: (user: UserProfile) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[420px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-end px-6 h-[60px]">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[rgba(120,120,128,0.12)] flex items-center justify-center hover:bg-[rgba(120,120,128,0.2)] transition-colors"
          >
            <X className="w-4 h-4 text-[#999]" />
          </button>
        </div>

        {/* User Info */}
        <div className="flex flex-col items-center px-6 pb-6">
          {/* Avatar - clickable to navigate to profile */}
          <button
            onClick={() => {
              onClose();
              onNavigateToProfile(user.id);
            }}
            className="w-[100px] h-[100px] rounded-full overflow-hidden mb-4 hover:opacity-80 transition-opacity"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImagePlaceholder size={100} borderRadius={50} />
            )}
          </button>

          {/* Name */}
          <h2 className="text-[22px] font-semibold text-[#212121] tracking-[-0.22px] leading-[1.2] mb-6">
            {user.name}
          </h2>

          {/* Report Button */}
          <button
            onClick={() => {
              onClose();
              onReport(user);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-full border border-[#D35741] text-[#D35741] hover:bg-[#D35741]/5 transition-colors"
          >
            <Flag className="w-4 h-4" />
            <span className="text-[15px] font-semibold tracking-[0.075px] leading-[20px]">{t('chat.report')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string | null;
  timestamp?: string;
  unread: number;
  participant_id?: string;  // The other participant's user ID
}

interface Group {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  lastMessage: string | null;
  timestamp?: string;
  unread: number;
  memberCount?: number;
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

interface ReplyingTo {
  id: string;
  content: string;
  senderName: string;
  senderId: string;
}

interface ChatItem {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string | null;
  timestamp?: string;
  unread: number;
  type: 'direct' | 'group';
  memberCount?: number;
  participant_id?: string;  // The other participant's user ID (for direct chats)
}

export function ChatPage() {
  const { t } = useTranslation();
  const { recipientId } = useParams<{ recipientId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversationParam = searchParams.get('conversation');
  const authUser = useAuthStore((state) => state.user);
  const { setActiveConversation } = useNotification();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ [conversationId: string]: string[] }>({});
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<ChatItem | null>(null);
  const [showReportModal, setShowReportModal] = useState<ChatItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedChatRef = useRef<ChatItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  // Keep ref in sync with state and update notification context
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    // Update notification context with active conversation to prevent showing
    // notifications for the chat the user is currently viewing
    setActiveConversation(selectedChat?.id || null);
  }, [selectedChat, setActiveConversation]);

  // Clear active conversation when leaving the chat page
  useEffect(() => {
    return () => {
      setActiveConversation(null);
    };
  }, [setActiveConversation]);

  // WebSocket event handling (connection is managed in UserLayout)
  useEffect(() => {
    // WebSocket is connected at app level in UserLayout
    // Just ensure connection if not already connected (edge case)
    const token = localStorage.getItem('auth_token');
    if (token && !chatWebSocket.isConnected()) {
      console.log('ChatPage: WebSocket not connected, connecting...');
      chatWebSocket.connect(token);
    }

    // Connection status handler
    const unsubConnection = chatWebSocket.onConnection((status) => {
      setWsConnected(status === 'connected');
      console.log('WebSocket status:', status);
    });

    // New message handler - use ref to avoid stale closure
    const unsubMessage = chatWebSocket.onMessage((wsMessage: WebSocketMessage) => {
      console.log('Received WebSocket message:', wsMessage);

      // Add message to list if it's for the current chat
      setMessages(prev => {
        // Check if message already exists by real ID
        if (prev.some(m => m.id === wsMessage.id)) {
          return prev;
        }

        // Check if this is replacing a temp message (optimistic update)
        // Match by tempId first, then fall back to matching by content + sender for
        // own messages that might not have tempId echoed back
        const tempIndex = wsMessage.tempId
          ? prev.findIndex(m => m.id === wsMessage.tempId)
          : -1;

        if (tempIndex !== -1) {
          // Replace temp message with real one
          const newMessages = [...prev];
          newMessages[tempIndex] = {
            ...newMessages[tempIndex],
            id: wsMessage.id,
            content: wsMessage.content,
          };
          return newMessages;
        }

        // Also check for temp messages by matching content + sender
        // This handles the case where tempId doesn't round-trip through the server
        const ownTempIndex = prev.findIndex(
          m => m.id.startsWith('temp-') &&
            m.sender_id === wsMessage.senderId &&
            m.content === wsMessage.content
        );
        if (ownTempIndex !== -1) {
          const newMessages = [...prev];
          newMessages[ownTempIndex] = {
            ...newMessages[ownTempIndex],
            id: wsMessage.id,
            content: wsMessage.content,
          };
          return newMessages;
        }

        // Use ref to get current selectedChat value (avoids stale closure)
        const currentChat = selectedChatRef.current;

        // Only add if for current conversation (using camelCase from WebSocket)
        if (currentChat && wsMessage.conversationId === currentChat.id) {
          return [...prev, {
            id: wsMessage.id,
            conversation_id: wsMessage.conversationId,
            sender_id: wsMessage.senderId,
            sender_name: wsMessage.senderName,
            content: wsMessage.content,
            type: wsMessage.type || 'text',
            is_ai: false,
            read: false,
            created_at: wsMessage.timestamp,
            reply_to_id: wsMessage.replyTo,
            reply_to_content: wsMessage.replyToContent,
            reply_to_sender_name: wsMessage.replyToSenderName,
            reply_to_sender_id: wsMessage.replyToSenderId,
          }];
        }
        return prev;
      });

      // Update conversation list with last message (using camelCase from WebSocket)
      setConversations(prev => prev.map(conv =>
        conv.id === wsMessage.conversationId
          ? { ...conv, lastMessage: wsMessage.content, timestamp: wsMessage.timestamp }
          : conv
      ));

      // Also update groups list with last message (using camelCase from WebSocket)
      setGroups(prev => prev.map(group =>
        group.id === wsMessage.conversationId
          ? { ...group, lastMessage: wsMessage.content, timestamp: wsMessage.timestamp }
          : group
      ));
    });

    // Typing indicator handler (using camelCase from WebSocket)
    const unsubTyping = chatWebSocket.onTyping((data) => {
      setTypingUsers(prev => {
        const users = prev[data.conversationId] || [];
        if (data.isTyping) {
          if (!users.includes(data.userName)) {
            return { ...prev, [data.conversationId]: [...users, data.userName] };
          }
        } else {
          return { ...prev, [data.conversationId]: users.filter(u => u !== data.userName) };
        }
        return prev;
      });
    });

    // Unread count update handler (using camelCase from WebSocket)
    const unsubUnread = chatWebSocket.onUnreadUpdate((data) => {
      // Use ref to get current selectedChat value (avoids stale closure)
      const currentChat = selectedChatRef.current;

      // If this conversation is currently open, don't update unread count
      // The user is already viewing these messages
      if (currentChat && currentChat.id === data.conversationId) {
        return;
      }

      // Update unread count in conversations list
      setConversations(prev => prev.map(conv =>
        conv.id === data.conversationId
          ? { ...conv, unread: data.unreadCount }
          : conv
      ));

      // Also update in groups list
      setGroups(prev => prev.map(group =>
        group.id === data.conversationId
          ? { ...group, unread: data.unreadCount }
          : group
      ));

      // Update global chat store for sidebar badge
      useChatStore.getState().setConversationUnread(data.conversationId, data.unreadCount);
    });

    return () => {
      unsubConnection();
      unsubMessage();
      unsubTyping();
      unsubUnread();
      // DO NOT disconnect WebSocket here - it's managed at the app level (UserLayout)
      // Disconnecting here would kill the connection when navigating away from chat
    };
  }, []); // Empty dependency - only run once on mount

  // Join/leave conversation room when chat selection changes or connection status changes
  useEffect(() => {
    if (selectedChat && wsConnected) {
      console.log('Joining conversation:', selectedChat.id, 'wsConnected:', wsConnected);
      chatWebSocket.joinConversation(selectedChat.id);
      return () => {
        console.log('Leaving conversation:', selectedChat.id);
        chatWebSocket.leaveConversation(selectedChat.id);
      };
    } else {
      console.log('Not joining - selectedChat:', selectedChat?.id, 'wsConnected:', wsConnected);
    }
  }, [selectedChat?.id, wsConnected]);

  // Re-join conversation if connection is restored while chat is selected
  useEffect(() => {
    if (wsConnected && selectedChat) {
      console.log('Connection restored, re-joining conversation:', selectedChat.id);
      chatWebSocket.joinConversation(selectedChat.id);
    }
  }, [wsConnected]);

  // Load conversations and groups
  useEffect(() => {
    loadConversations();
    loadGroups();
    loadCurrentUser();
  }, []);

  // Handle recipient ID from URL (for Contact button)
  useEffect(() => {
    const initConversation = async () => {
      if (recipientId) {
        try {
          // Create or get existing conversation
          const response = await api.post('/chat/conversations/direct', {
            recipient_id: recipientId,
          });
          if (response.data) {
            // Reload conversations and select the new one
            await loadConversations();
            setSelectedChat({
              id: response.data.id,
              name: response.data.name || 'Chat',
              avatar: response.data.avatar,
              lastMessage: null,
              unread: 0,
              type: 'direct',
              participant_id: recipientId,
            });
            // Clear the URL parameter
            navigate('/app/chat', { replace: true });
          }
        } catch (error) {
          console.error('Failed to create conversation:', error);
        }
      }
    };
    initConversation();
  }, [recipientId]);

  // Handle conversation param from URL
  useEffect(() => {
    if (conversationParam && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationParam);
      if (conv) {
        setSelectedChat({ ...conv, type: 'direct' });
      }
    }
  }, [conversationParam, conversations]);

  // Load messages when chat is selected and mark as read
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id, selectedChat.type);

      // Mark messages as read via API (this updates the database)
      // This ensures the backend unread count is accurate
      // Always call this when opening a chat, not just when unread > 0
      const markAsRead = async () => {
        try {
          const endpoint = selectedChat.type === 'group'
            ? `/chat/groups/${selectedChat.id}/read`
            : `/chat/conversations/${selectedChat.id}/read`;
          await api.post(endpoint);
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }
      };

      // Always mark as read when opening the chat
      markAsRead();

      // Clear unread count for this chat in local state immediately
      if (selectedChat.unread > 0) {
        setConversations(prev => prev.map(conv =>
          conv.id === selectedChat.id ? { ...conv, unread: 0 } : conv
        ));
        setGroups(prev => prev.map(group =>
          group.id === selectedChat.id ? { ...group, unread: 0 } : group
        ));
        // Update the selected chat state as well
        setSelectedChat(prev => prev ? { ...prev, unread: 0 } : null);
        // Clear in global store for sidebar badge
        useChatStore.getState().setConversationUnread(selectedChat.id, 0);
      }
    }
  }, [selectedChat?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/profile/me');
      if (response.data) {
        setCurrentUserId(response.data.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await api.get('/chat/conversations');
      if (response.data) {
        setConversations(response.data);
        // Sync ALL conversation unread counts to global store (including 0s to clear stale data)
        response.data.forEach((conv: any) => {
          useChatStore.getState().setConversationUnread(conv.id, conv.unread || 0);
        });
      }
    } catch (error) {
      console.log('Conversations not available yet');
      setConversations([]);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await api.get('/chat/groups');
      if (response.data) {
        setGroups(response.data);
        // Sync ALL group unread counts to global store (including 0s to clear stale data)
        response.data.forEach((group: any) => {
          useChatStore.getState().setConversationUnread(group.id, group.unread || 0);
        });
      }
    } catch (error) {
      console.log('Groups not available yet');
      setGroups([]);
    }
  };

  const loadMessages = async (chatId: string, chatType: string) => {
    setIsLoadingMessages(true);
    try {
      const endpoint = chatType === 'group'
        ? `/chat/groups/${chatId}/messages`
        : `/chat/conversations/${chatId}/messages`;
      console.log('ChatPage: loadMessages called for:', chatId, chatType);
      const response = await api.get(endpoint);
      console.log('ChatPage: API returned', response.data?.length || 0, 'messages');
      if (response.data && response.data.length > 0) {
        console.log('ChatPage: First message:', response.data[0]?.id, response.data[0]?.content?.substring(0, 50));
        console.log('ChatPage: Last message:', response.data[response.data.length - 1]?.id, response.data[response.data.length - 1]?.content?.substring(0, 50));
      }
      if (response.data) {
        setMessages(response.data);
      }

      // Load group members if it's a group chat
      if (chatType === 'group') {
        loadGroupMembers(chatId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      // Get group details which includes members array
      const response = await api.get(`/chat/groups/${groupId}`);
      if (response.data && response.data.members) {
        setGroupMembers(response.data.members.map((m: any) => ({
          id: m.id || m.user_id,
          name: m.name || m.user_name,
          avatar: m.avatar || m.profile_image_url,
        })));
      }
    } catch (error) {
      console.error('Error loading group members:', error);
      setGroupMembers([]);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo({
      id: message.id,
      content: message.content,
      senderName: message.sender_name,
      senderId: message.sender_id,
    });
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleReplyPrivately = async (message: Message) => {
    if (message.sender_id === currentUserId) return;
    try {
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: message.sender_id,
      });
      if (response.data) {
        await loadConversations();
        setSelectedChat({
          id: response.data.id,
          name: message.sender_name,
          avatar: undefined,
          lastMessage: null,
          unread: 0,
          type: 'direct',
          participant_id: message.sender_id,
        });
      }
    } catch (error) {
      console.error('Failed to start private chat:', error);
    }
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if this is the last message in a consecutive group from same sender
  const isLastMessageFromSender = (index: number) => {
    if (index === messages.length - 1) return true;
    const currentMsg = messages[index];
    const nextMsg = messages[index + 1];
    return currentMsg.sender_id !== nextMsg.sender_id;
  };

  // Check if this is the first message in a consecutive group from same sender
  const isFirstMessageFromSender = (index: number) => {
    if (index === 0) return true;
    const currentMsg = messages[index];
    const prevMsg = messages[index - 1];
    return currentMsg.sender_id !== prevMsg.sender_id;
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedChat || isSending) return;

    const messageContent = inputText.trim();
    const currentReply = replyingTo;
    setInputText('');
    setReplyingTo(null);
    setIsSending(true);

    // Stop typing indicator
    if (wsConnected) {
      chatWebSocket.stopTyping(selectedChat.id);
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      conversation_id: selectedChat.id,
      sender_id: currentUserId,
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

    // Use WebSocket if connected, otherwise fall back to REST API
    if (wsConnected) {
      // Join conversation room if not already joined (for group chats)
      chatWebSocket.joinConversation(selectedChat.id);
      chatWebSocket.sendMessage(selectedChat.id, messageContent, tempId, currentReply?.id);
      setIsSending(false);
    } else {
      // Fall back to REST API when WebSocket is not connected
      try {
        const endpoint = selectedChat.type === 'group'
          ? `/chat/groups/${selectedChat.id}/messages`
          : `/chat/conversations/${selectedChat.id}/messages`;

        const response = await api.post(endpoint, {
          content: messageContent,
          reply_to_id: currentReply?.id,
        });

        if (response.data) {
          // Replace temp message with real one
          setMessages(prev =>
            prev.map(msg =>
              msg.id === tempMessage.id ? response.data : msg
            )
          );
        }
      } catch (error) {
        console.error('Error sending message:', error);
        // Remove temp message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      } finally {
        setIsSending(false);
      }
    }
  };

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Send typing indicator via WebSocket
    if (wsConnected && selectedChat) {
      chatWebSocket.startTyping(selectedChat.id);

      // Clear previous timeout and set a new one to stop typing after 2 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedChat) {
          chatWebSocket.stopTyping(selectedChat.id);
        }
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || isUploadingImage) return;

    // Reset input so the same file can be re-selected
    e.target.value = '';

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await api.post(`/upload/chat/${selectedChat.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imageUrl = uploadResponse.data.url || uploadResponse.data.image_url;
      if (!imageUrl) throw new Error('No image URL returned');

      // Send the image URL as a message
      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        conversation_id: selectedChat.id,
        sender_id: currentUserId,
        sender_name: 'You',
        content: imageUrl,
        type: 'image',
        is_ai: false,
        read: true,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMessage]);

      if (wsConnected) {
        chatWebSocket.joinConversation(selectedChat.id);
        chatWebSocket.sendMessage(selectedChat.id, imageUrl, tempId);
      } else {
        const endpoint = selectedChat.type === 'group'
          ? `/chat/groups/${selectedChat.id}/messages`
          : `/chat/conversations/${selectedChat.id}/messages`;

        const response = await api.post(endpoint, {
          content: imageUrl,
          type: 'image',
        });

        if (response.data) {
          setMessages(prev =>
            prev.map(msg => msg.id === tempMessage.id ? response.data : msg)
          );
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setChatMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Mark as Read
  const handleMarkAsRead = async (chat: ChatItem) => {
    try {
      const endpoint = chat.type === 'group'
        ? `/chat/groups/${chat.id}/read`
        : `/chat/conversations/${chat.id}/read`;
      await api.post(endpoint);

      // Update local state
      if (chat.type === 'group') {
        setGroups(prev => prev.map(g => g.id === chat.id ? { ...g, unread: 0 } : g));
      } else {
        setConversations(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
      }
      // Update global store
      useChatStore.getState().setConversationUnread(chat.id, 0);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
    setChatMenuOpen(null);
  };

  // Handle Delete Conversation
  const handleDeleteConversation = async () => {
    if (!showDeleteModal) return;

    setIsDeleting(true);
    try {
      const endpoint = showDeleteModal.type === 'group'
        ? `/chat/groups/${showDeleteModal.id}`
        : `/chat/conversations/${showDeleteModal.id}`;
      await api.delete(endpoint);

      // Update local state
      if (showDeleteModal.type === 'group') {
        setGroups(prev => prev.filter(g => g.id !== showDeleteModal.id));
      } else {
        setConversations(prev => prev.filter(c => c.id !== showDeleteModal.id));
      }

      // Clear selection if this was the selected chat
      if (selectedChat?.id === showDeleteModal.id) {
        setSelectedChat(null);
        setMessages([]);
      }

      // Update global store
      useChatStore.getState().setConversationUnread(showDeleteModal.id, 0);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(null);
    }
  };

  // Handle Report Conversation
  const handleReportConversation = async () => {
    if (!showReportModal || !reportReason) return;

    setIsSubmittingReport(true);
    try {
      await api.post('/support/reports', {
        reported_type: showReportModal.type === 'group' ? 'group' : 'conversation',
        reported_id: showReportModal.id,
        reported_name: showReportModal.name,
        reason: reportReason,
        description: reportDescription,
      });

      // Reset form and show success modal
      setReportReason('');
      setReportDescription('');
      setShowReportModal(null);
      setShowReportSuccess(true);
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Combine conversations and groups into a single list
  const allChats: ChatItem[] = [
    ...conversations.map(c => ({ ...c, type: 'direct' as const })),
    ...groups.map(g => ({
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      lastMessage: g.lastMessage,
      timestamp: g.timestamp,
      unread: g.unread,
      type: 'group' as const,
      memberCount: g.memberCount,
    })),
  ];

  return (
    <div className="mx-4 sm:mx-8 md:mx-16 lg:mx-24 py-4 sm:py-6 bg-white h-[calc(100vh-64px)]">
      <div className="h-full overflow-hidden">
        <div className="flex h-full">
          {/* Left Sidebar - Chat List (hidden on mobile when chat is selected) */}
          <div className={`w-full sm:w-[280px] flex-shrink-0 flex flex-col ${selectedChat ? 'hidden sm:flex' : 'flex'}`}>
            {/* Header */}
            <div className="px-4 py-4">
              <h1 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f]">{t('chat.title')}</h1>
            </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {allChats.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              {t('chat.noConversations')}
            </div>
          ) : (
            allChats.map((chat) => (
              <div
                key={`${chat.type}-${chat.id}`}
                className={`group relative w-full flex items-center gap-2 px-4 py-3 rounded-2xl transition-colors cursor-pointer ${
                  selectedChat?.id === chat.id && selectedChat?.type === chat.type
                    ? 'bg-[#f4f4f4]'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedChat(chat)}
              >
                {/* Avatar - clickable for profile */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (chat.type === 'direct' && chat.participant_id) {
                      setSelectedUserProfile({
                        id: chat.participant_id,
                        name: chat.name,
                        avatar: chat.avatar,
                      });
                    }
                  }}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                  {chat.avatar ? (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder size={32} borderRadius={16} />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-medium text-[#1d1d1f] truncate leading-tight">
                    {chat.name}
                  </p>
                  <p className="text-base text-[#1d1d1f] opacity-50 truncate leading-tight">
                    {chat.lastMessage || '—'}
                  </p>
                </div>

                {/* Unread Badge */}
                {chat.unread > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center px-1.5">
                    {chat.unread > 99 ? '99+' : chat.unread}
                  </span>
                )}

                {/* 3-dot Menu Button - appears on hover */}
                <div className="relative" ref={chatMenuOpen === `${chat.type}-${chat.id}` ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatMenuOpen(chatMenuOpen === `${chat.type}-${chat.id}` ? null : `${chat.type}-${chat.id}`);
                    }}
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      chatMenuOpen === `${chat.type}-${chat.id}`
                        ? 'bg-gray-200 opacity-100'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-gray-200'
                    }`}
                  >
                    <MoreVertical className="w-4 h-4 text-[#1d1d1f]" />
                  </button>

                  {/* Dropdown Menu */}
                  {chatMenuOpen === `${chat.type}-${chat.id}` && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(chat);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#1d1d1f] hover:bg-gray-50 transition-colors"
                      >
                        <CheckCheck className="w-4 h-4" />
                        {t('chat.markAsRead')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatMenuOpen(null);
                          setShowReportModal(chat);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#1d1d1f] hover:bg-gray-50 transition-colors"
                      >
                        <Flag className="w-4 h-4" />
                        {t('chat.report')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatMenuOpen(null);
                          setShowDeleteModal(chat);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('chat.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

          {/* Divider - hidden on mobile */}
          <div className="hidden sm:block w-px bg-[rgba(0,0,0,0.1)]" />

          {/* Right Side - Chat Area (shown on mobile when chat is selected) */}
          <div className={`flex-1 flex flex-col ${selectedChat ? 'flex' : 'hidden sm:flex'}`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 sm:px-8 pt-4 sm:pt-8 pb-4 border-b border-[rgba(33,33,33,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="sm:hidden w-10 h-10 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-[#1d1d1f]" />
                  </button>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-[#1d1d1f]">
                      {selectedChat.name}
                    </h2>
                  <p className="text-base text-[#1d1d1f] opacity-50 flex items-center gap-2">
                    {selectedChat.type === 'group'
                      ? t('chat.members', { count: groupMembers.length > 0 ? groupMembers.length : (selectedChat.memberCount || 0) })
                      : t('chat.directMessage')}
                    {wsConnected && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {t('chat.live')}
                      </span>
                    )}
                  </p>
                  </div>
                </div>
                {/* Group Members Icon - only for group chats */}
                {selectedChat.type === 'group' && (
                  <button
                    onClick={() => setShowGroupMembers(true)}
                    className="w-10 h-10 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                  >
                    <Users className="w-5 h-5 text-[#1d1d1f]" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col px-8 overflow-hidden">
              {/* Date */}
              <div className="text-center py-4">
                <span className="text-[13px] text-[#1d1d1f] opacity-50">{t('chat.today')}</span>
              </div>

              {/* Messages or Empty State */}
              {isLoadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#212121]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-[rgba(33,33,33,0.04)] rounded-xl p-4 w-[395px] text-center">
                    <p className="text-sm text-[#212121] leading-5 tracking-[0.07px]">
                      {t('chat.startConversation')}
                    </p>
                    <p className="text-sm text-[#212121] opacity-50 leading-5 tracking-[0.07px]">
                      {t('chat.askAbout')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-4 space-y-1">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === currentUserId;
                    const showAvatar = isLastMessageFromSender(index);
                    const showSenderName = isFirstMessageFromSender(index);
                    const senderMember = groupMembers.find(m => m.id === message.sender_id);

                    return (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 group ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Avatar for other users' messages (only show on last message in group) */}
                        {!isOwnMessage && selectedChat.type === 'group' && (
                          <div className="w-8 h-8 flex-shrink-0">
                            {showAvatar && (
                              <button
                                onClick={() => navigate(`/app/user/${message.sender_id}`)}
                                className="w-8 h-8 rounded-full bg-[#e5e5e5] flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
                              >
                                {senderMember?.avatar ? (
                                  <img src={senderMember.avatar} alt={message.sender_name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <span className="text-[11px] font-semibold text-[#1d1d1f]">
                                    {getInitials(message.sender_name)}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Hover actions - left side for own messages */}
                        {isOwnMessage && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(message)}
                              className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                              title={t('chat.reply')}
                            >
                              <Reply className="w-4 h-4 text-[#1d1d1f]" />
                            </button>
                          </div>
                        )}

                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            isOwnMessage
                              ? 'bg-[#212121] text-white'
                              : 'bg-[rgba(33,33,33,0.04)] text-[#212121]'
                          }`}
                        >
                          {!isOwnMessage && selectedChat.type === 'group' && showSenderName && (
                            <p className="text-xs font-medium opacity-70 mb-1">
                              {message.sender_name}
                            </p>
                          )}
                          {/* Quoted message for replies */}
                          {message.reply_to_id && message.reply_to_content && (
                            <div
                              className={`mb-2 p-2 rounded-lg border-l-2 ${
                                isOwnMessage
                                  ? 'bg-white/10 border-white/40'
                                  : 'bg-[#212121]/5 border-[#212121]/30'
                              }`}
                            >
                              <p className={`text-[11px] font-medium mb-0.5 ${
                                isOwnMessage ? 'text-white/70' : 'text-[#212121]/70'
                              }`}>
                                {message.reply_to_sender_name}
                              </p>
                              <p className={`text-[12px] line-clamp-2 ${
                                isOwnMessage ? 'text-white/60' : 'text-[#212121]/60'
                              }`}>
                                {message.reply_to_content}
                              </p>
                            </div>
                          )}
                          {message.type === 'image' ? (
                            <img
                              src={message.content}
                              alt="Shared image"
                              className="max-w-[280px] rounded-lg cursor-pointer"
                              loading="lazy"
                              onClick={() => window.open(message.content, '_blank')}
                            />
                          ) : (
                            <p className="text-[15px] leading-5">{message.content}</p>
                          )}
                          <p className={`text-[11px] mt-1 ${isOwnMessage ? 'text-white/60' : 'text-[#212121]/50'}`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>

                        {/* Hover actions - right side for others' messages */}
                        {!isOwnMessage && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(message)}
                              className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                              title={t('chat.reply')}
                            >
                              <Reply className="w-4 h-4 text-[#1d1d1f]" />
                            </button>
                            {selectedChat.type === 'group' && (
                              <>
                                <button
                                  onClick={() => handleReplyPrivately(message)}
                                  className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                                  title={t('chat.replyPrivately')}
                                >
                                  <CornerUpRight className="w-4 h-4 text-[#1d1d1f]" />
                                </button>
                                <button
                                  onClick={() => navigate(`/app/user/${message.sender_id}`)}
                                  className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                                  title={t('chat.viewProfile')}
                                >
                                  <MessageSquare className="w-4 h-4 text-[#1d1d1f]" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Typing Indicator */}
              {selectedChat && typingUsers[selectedChat.id]?.length > 0 && (
                <div className="px-4 py-2 text-[13px] text-[#212121]/60 italic">
                  {typingUsers[selectedChat.id].join(', ')} {typingUsers[selectedChat.id].length === 1 ? t('chat.isTyping') : t('chat.areTyping')}
                </div>
              )}

              {/* Reply Preview */}
              {replyingTo && (
                <div className="mx-4 mb-2 p-3 bg-[#f5f5f5] rounded-lg border-l-4 border-[#212121] flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#212121] mb-1">
                      {t('chat.replyingTo', { name: replyingTo.senderName })}
                    </p>
                    <p className="text-[13px] text-[#212121]/70 truncate">
                      {replyingTo.content}
                    </p>
                  </div>
                  <button
                    onClick={cancelReply}
                    className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-[#212121]/50" />
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 flex items-center bg-[rgba(33,33,33,0.04)] rounded-full px-4 py-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={t('chat.placeholder')}
                    className="flex-1 bg-transparent text-[15px] text-[#212121] placeholder:text-[#212121]/50 outline-none"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="w-11 h-11 rounded-full bg-[#f1f1f1] flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <Image className="w-[18px] h-[18px] text-[#212121]" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isSending}
                  className="w-11 h-11 rounded-full bg-[#212121] flex items-center justify-center hover:bg-black transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State - No Chat Selected */
          <div className="flex-1 flex items-center justify-center pr-8">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ImagePlaceholder size={48} borderRadius={24} />
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">{t('chat.selectConversation')}</h2>
              <p className="text-[#1d1d1f] opacity-50">{t('chat.selectConversationHint')}</p>
            </div>
          </div>
        )}
          </div>
        </div>

        {/* User Profile Modal */}
        {selectedUserProfile && (
          <UserProfileModal
            user={selectedUserProfile}
            onClose={() => setSelectedUserProfile(null)}
            onNavigateToProfile={(userId) => navigate(`/app/user/${userId}`)}
            onReport={(user) => {
              setShowReportModal({
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                lastMessage: null,
                unread: 0,
                type: 'direct'
              });
            }}
          />
        )}

        {/* Group Members Modal */}
        {showGroupMembers && selectedChat?.type === 'group' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[420px] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 h-[60px] border-b border-[rgba(33,33,33,0.05)]">
                <h2 className="text-[18px] font-semibold text-[#212121]">
                  {t('chat.groupMembers')} ({groupMembers.length})
                </h2>
                <button
                  onClick={() => setShowGroupMembers(false)}
                  className="w-8 h-8 rounded-full bg-[rgba(120,120,128,0.12)] flex items-center justify-center hover:bg-[rgba(120,120,128,0.2)] transition-colors"
                >
                  <X className="w-4 h-4 text-[#999]" />
                </button>
              </div>

              {/* Members List */}
              <div className="max-h-[400px] overflow-y-auto">
                {groupMembers.map((member) => {
                  // For current user, use auth store data to show latest profile info
                  const isCurrentUser = member.id === currentUserId;
                  const displayName = isCurrentUser && authUser?.name ? authUser.name : member.name;
                  const displayAvatar = isCurrentUser && authUser?.profile_image_url ? authUser.profile_image_url : member.avatar;

                  return (
                    <button
                      key={member.id}
                      onClick={() => {
                        setShowGroupMembers(false);
                        navigate(`/app/user/${member.id}`);
                      }}
                      className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[rgba(33,33,33,0.02)] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#e5e5e5] flex items-center justify-center overflow-hidden">
                        {displayAvatar ? (
                          <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-[13px] font-semibold text-[#1d1d1f]">
                            {getInitials(displayName)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[15px] font-medium text-[#212121]">{displayName}</p>
                        {isCurrentUser && (
                          <p className="text-[13px] text-[#212121]/50">{t('chat.you')}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[24px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[400px] overflow-hidden">
              <div className="p-6">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>

                {/* Title */}
                <h2 className="text-[18px] font-semibold text-[#212121] text-center mb-2">
                  {t('chat.deleteConversation')}
                </h2>

                {/* Description */}
                <p className="text-[15px] text-[#212121]/60 text-center mb-6">
                  {t('chat.deleteConfirmation', { name: showDeleteModal.name })}
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(null)}
                    className="flex-1 px-4 py-3 text-[15px] font-semibold text-[#212121] bg-[rgba(33,33,33,0.05)] rounded-full hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                    disabled={isDeleting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="flex-1 px-4 py-3 text-[15px] font-semibold text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={isDeleting}
                  >
                    {isDeleting ? t('chat.deleting') : t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[24px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[480px] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 h-[60px] border-b border-[rgba(33,33,33,0.05)]">
                <h2 className="text-[18px] font-semibold text-[#212121]">
                  {t('chat.reportConversation')}
                </h2>
                <button
                  onClick={() => {
                    setShowReportModal(null);
                    setReportReason('');
                    setReportDescription('');
                  }}
                  className="w-8 h-8 rounded-full bg-[rgba(120,120,128,0.12)] flex items-center justify-center hover:bg-[rgba(120,120,128,0.2)] transition-colors"
                >
                  <X className="w-4 h-4 text-[#999]" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-[15px] text-[#212121]/60 mb-4">
                  {t('chat.reportFor', { name: showReportModal.name })}
                </p>

                {/* Reason Selection */}
                <div className="mb-4">
                  <label className="block text-[14px] font-medium text-[#212121] mb-2">
                    {t('chat.reasonLabel')}
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-4 py-3 text-[15px] border border-[rgba(33,33,33,0.1)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#212121]/20"
                  >
                    <option value="">{t('chat.selectReason')}</option>
                    <option value="spam">{t('chat.reportReasons.spam')}</option>
                    <option value="harassment">{t('chat.reportReasons.harassment')}</option>
                    <option value="inappropriate">{t('chat.reportReasons.inappropriate')}</option>
                    <option value="fraud">{t('chat.reportReasons.fraud')}</option>
                    <option value="impersonation">{t('chat.reportReasons.impersonation')}</option>
                    <option value="other">{t('chat.reportReasons.other')}</option>
                  </select>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-[14px] font-medium text-[#212121] mb-2">
                    {t('chat.additionalDetails')}
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder={t('chat.provideContext')}
                    rows={4}
                    className="w-full px-4 py-3 text-[15px] border border-[rgba(33,33,33,0.1)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#212121]/20 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleReportConversation}
                  disabled={!reportReason || isSubmittingReport}
                  className="w-full px-4 py-3 text-[15px] font-semibold text-white bg-[#212121] rounded-full hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingReport ? t('chat.submitting') : t('chat.submitReport')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Success Modal */}
        {showReportSuccess && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[24px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[400px] overflow-hidden">
              <div className="p-6">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>

                {/* Title */}
                <h2 className="text-[18px] font-semibold text-[#212121] text-center mb-2">
                  {t('chat.reportSubmitted')}
                </h2>

                {/* Description */}
                <p className="text-[15px] text-[#212121]/60 text-center mb-6">
                  {t('chat.reportThanks')}
                </p>

                {/* Button */}
                <button
                  onClick={() => setShowReportSuccess(false)}
                  className="w-full px-4 py-3 text-[15px] font-semibold text-white bg-[#212121] rounded-full hover:bg-black transition-colors"
                >
                  {t('common.done')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
