import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { chatService, Conversation, Message, TypingIndicator } from '@/services/chatService';
import { useAuthStore } from '@watchsphere/shared/stores';

// Callback for showing in-app notifications
type NotificationCallback = (data: {
  title: string;
  body: string;
  avatar?: string;
  conversationId: string;
  isGroup: boolean;
}) => void;

// Global notification callback setter
let notificationCallback: NotificationCallback | null = null;
export const setNotificationCallback = (callback: NotificationCallback | null) => {
  notificationCallback = callback;
};

// Import notifications dynamically to avoid crashes
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');

  // Configure notifications if available
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (error) {
  console.log('Notifications not available:', error);
}

interface ChatContextType {
  conversations: Conversation[];
  groups: Conversation[];
  messages: Map<string, Message[]>;
  loadingConversations: boolean;
  loadingMessages: Map<string, boolean>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  activeConversationId: string | null;

  // Methods
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, replyTo?: string) => void;
  markAsRead: (conversationId: string, messageIds: string[]) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  deleteMessage: (messageId: string) => void;
  setActiveConversation: (conversationId: string | null) => void;
  updateConversationsFromApi: (apiConversations: any[]) => void;
  updateGroupsFromApi: (apiGroups: any[]) => void;

  // Getters
  getConversation: (conversationId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getTotalUnreadCount: () => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState<Map<string, boolean>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Ref to track active conversation in callbacks
  const activeConversationRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  // Ref to track current user ID in callbacks (avoids stale closure issues)
  const userIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user]);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
  }, []);

  // Connect to chat service when user logs in
  useEffect(() => {
    if (user && token) {
      console.log('=== ChatContext: Connecting to chat service ===');
      console.log('ChatContext: User ID:', user.id);
      console.log('ChatContext: Token present:', !!token);
      console.log('ChatContext: Token length:', token?.length);
      chatService.connect(token);
      loadConversations();

      // Request notification permissions if available
      if (Notifications && Notifications.requestPermissionsAsync) {
        Notifications.requestPermissionsAsync().catch((err: any) => {
          console.log('Failed to request notification permissions:', err);
        });
      }
    } else {
      console.log('ChatContext: NOT connecting - user:', !!user, 'token:', !!token);
    }

    return () => {
      console.log('ChatContext: Disconnecting chat service');
      chatService.disconnect();
    };
  }, [user, token]);

  // Setup event listeners
  useEffect(() => {
    // Connection status
    const handleConnection = (data: { status: string; attempt?: number }) => {
      setConnectionStatus(data.status as any);
    };

    // New message received
    const handleNewMessage = (message: Message) => {
      console.log('ChatContext: handleNewMessage called with:', message.id, 'for conv:', message.conversationId);
      console.log('ChatContext: Current user ID from ref:', userIdRef.current, 'sender:', message.senderId);

      // Track if this is a new message from someone else (use ref for latest user ID)
      const isFromOtherUser = message.senderId !== userIdRef.current;
      const isNotActive = message.conversationId !== activeConversationRef.current;
      console.log('ChatContext: isFromOtherUser:', isFromOtherUser, 'isNotActive:', isNotActive);

      setMessages(prev => {
        const convMessages = prev.get(message.conversationId) || [];
        console.log('ChatContext: existing messages for conv:', convMessages.length);

        // Check if message already exists
        const exists = convMessages.some(m => m.id === message.id);
        if (exists) {
          console.log('ChatContext: message already exists, skipping');
          return prev;
        }

        const newMap = new Map(prev);
        newMap.set(message.conversationId, [...convMessages, message]);
        console.log('ChatContext: added message, new count:', newMap.get(message.conversationId)?.length);
        return newMap;
      });

      // Check if message belongs to a conversation or group
      let isGroup = false;
      let conversationName = '';
      let conversationAvatar: string | undefined;

      // Update conversation's last message (for direct messages)
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === message.conversationId) {
            conversationName = conv.name;
            conversationAvatar = conv.avatar;
            return {
              ...conv,
              lastMessage: message,
              unreadCount: isFromOtherUser && isNotActive ? conv.unreadCount + 1 : conv.unreadCount,
              updatedAt: message.timestamp,
            };
          }
          return conv;
        });
        return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });

      // Also update groups (for group messages)
      setGroups(prev => {
        const updated = prev.map(group => {
          if (group.id === message.conversationId) {
            isGroup = true;
            conversationName = group.name;
            conversationAvatar = group.avatar;
            return {
              ...group,
              lastMessage: message,
              unreadCount: isFromOtherUser && isNotActive ? group.unreadCount + 1 : group.unreadCount,
              updatedAt: message.timestamp,
            };
          }
          return group;
        });
        return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });

      // Show notification only if:
      // 1. Message is from someone else
      // 2. The conversation is NOT currently active (user isn't viewing it)
      if (isFromOtherUser && isNotActive) {
        // Show in-app notification banner only (not system notification)
        // System notifications are only shown when app is in background
        if (notificationCallback) {
          notificationCallback({
            title: conversationName || message.senderName,
            body: message.content,
            avatar: conversationAvatar,
            conversationId: message.conversationId,
            isGroup,
          });
        }
        // Note: System notification (showNotification) is NOT called here
        // because the app is in the foreground and we're showing in-app banner instead
      }
    };

    // Replace temp message with real one
    const handleMessageReplace = (data: { tempId: string; message: Message }) => {
      setMessages(prev => {
        const convMessages = prev.get(data.message.conversationId) || [];
        const newMap = new Map(prev);
        newMap.set(
          data.message.conversationId,
          convMessages.map(m => m.id === data.tempId ? data.message : m)
        );
        return newMap;
      });
    };

    // Message failed
    const handleMessageFailed = (data: { tempId: string; error?: string }) => {
      setMessages(prev => {
        const newMap = new Map(prev);
        // Find conversation with temp message
        for (const [convId, convMessages] of prev.entries()) {
          const messageIndex = convMessages.findIndex(m => m.id === data.tempId);
          if (messageIndex !== -1) {
            const updatedMessages = [...convMessages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              status: 'sending', // Could add 'failed' status
            };
            newMap.set(convId, updatedMessages);
            break;
          }
        }
        return newMap;
      });
    };

    // Message status update
    const handleMessageStatus = (data: { messageId: string; status: Message['status'] }) => {
      setMessages(prev => {
        const newMap = new Map(prev);
        for (const [convId, convMessages] of prev.entries()) {
          const messageIndex = convMessages.findIndex(m => m.id === data.messageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...convMessages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              status: data.status,
            };
            newMap.set(convId, updatedMessages);
            break;
          }
        }
        return newMap;
      });
    };

    // Message deleted
    const handleMessageDeleted = (messageId: string) => {
      setMessages(prev => {
        const newMap = new Map(prev);
        for (const [convId, convMessages] of prev.entries()) {
          newMap.set(
            convId,
            convMessages.filter(m => m.id !== messageId)
          );
        }
        return newMap;
      });
    };

    // Typing indicators
    const handleTypingStart = (data: TypingIndicator) => {
      setConversations(prev => prev.map(conv => {
        if (conv.id === data.conversationId) {
          const typing = [...conv.typing];
          if (!typing.includes(data.userId)) {
            typing.push(data.userId);
          }
          return { ...conv, typing };
        }
        return conv;
      }));
    };

    const handleTypingStop = (data: TypingIndicator) => {
      setConversations(prev => prev.map(conv => {
        if (conv.id === data.conversationId) {
          return {
            ...conv,
            typing: conv.typing.filter(id => id !== data.userId),
          };
        }
        return conv;
      }));
    };

    // Conversation updated
    const handleConversationUpdated = (conversation: Conversation) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === conversation.id);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = conversation;
          return updated;
        } else {
          return [conversation, ...prev];
        }
      });
    };

    // User presence
    const handleUserOnline = (userId: string) => {
      setConversations(prev => prev.map(conv => ({
        ...conv,
        participants: conv.participants.map(p =>
          p.id === userId ? { ...p, online: true } : p
        ),
      })));
    };

    const handleUserOffline = (userId: string) => {
      setConversations(prev => prev.map(conv => ({
        ...conv,
        participants: conv.participants.map(p =>
          p.id === userId ? { ...p, online: false } : p
        ),
      })));
    };

    // Unread count update
    const handleUnreadUpdate = (data: { conversationId: string; unreadCount: number }) => {
      // Update conversations
      setConversations(prev => prev.map(conv =>
        conv.id === data.conversationId
          ? { ...conv, unreadCount: data.unreadCount }
          : conv
      ));
      // Also update groups
      setGroups(prev => prev.map(group =>
        group.id === data.conversationId
          ? { ...group, unreadCount: data.unreadCount }
          : group
      ));
    };

    // Register listeners
    chatService.on('connection', handleConnection);
    chatService.on('message:new', handleNewMessage);
    chatService.on('message:replace', handleMessageReplace);
    chatService.on('message:failed', handleMessageFailed);
    chatService.on('message:status', handleMessageStatus);
    chatService.on('message:deleted', handleMessageDeleted);
    chatService.on('typing:start', handleTypingStart);
    chatService.on('typing:stop', handleTypingStop);
    chatService.on('conversation:updated', handleConversationUpdated);
    chatService.on('user:online', handleUserOnline);
    chatService.on('user:offline', handleUserOffline);
    chatService.on('unread:update', handleUnreadUpdate);

    return () => {
      chatService.off('connection', handleConnection);
      chatService.off('message:new', handleNewMessage);
      chatService.off('message:replace', handleMessageReplace);
      chatService.off('message:failed', handleMessageFailed);
      chatService.off('message:status', handleMessageStatus);
      chatService.off('message:deleted', handleMessageDeleted);
      chatService.off('typing:start', handleTypingStart);
      chatService.off('typing:stop', handleTypingStop);
      chatService.off('conversation:updated', handleConversationUpdated);
      chatService.off('user:online', handleUserOnline);
      chatService.off('user:offline', handleUserOffline);
      chatService.off('unread:update', handleUnreadUpdate);
    };
  }, [user]);

  const showNotification = async (message: Message) => {
    // Skip if notifications are not available
    if (!Notifications || !Notifications.scheduleNotificationAsync) {
      return;
    }

    try {
      const conversation = conversations.find(c => c.id === message.conversationId);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: conversation?.name || message.senderName,
          body: message.content,
          data: { conversationId: message.conversationId },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.log('Failed to show notification:', error);
    }
  };

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      // Conversations are loaded from the API via chat.tsx's loadConversations
      // which calls updateConversationsFromApi. This function is only for
      // compatibility with the chat service connection flow.
      // Don't set mock data here as it causes persistent unread badges.
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(prev => new Map(prev).set(conversationId, true));
    try {
      // Messages are loaded directly by the chat screen components via API
      // This function is kept for compatibility but doesn't load mock data
      // Join conversation room for real-time updates
      chatService.joinConversation(conversationId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(prev => new Map(prev).set(conversationId, false));
    }
  }, []);

  const sendMessage = useCallback((conversationId: string, content: string, replyTo?: string) => {
    chatService.sendMessage(conversationId, content, 'text', replyTo);
  }, []);

  const markAsRead = useCallback((conversationId: string, messageIds: string[]) => {
    chatService.markAsRead(conversationId, messageIds);

    // Update local unread count
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
    ));
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    chatService.startTyping(conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    chatService.stopTyping(conversationId);
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    chatService.deleteMessage(messageId);
  }, []);

  const updateConversationsFromApi = useCallback((apiConversations: any[]) => {
    // Transform API conversations to the ChatContext format
    // Note: lastMessage from API is a string (the message content), not an object
    const transformedConversations: Conversation[] = apiConversations.map(conv => ({
      id: conv.id,
      type: conv.type || 'direct',
      name: conv.name,
      avatar: conv.avatar,
      participants: conv.participants || [],
      unreadCount: conv.unread || 0,
      typing: [],
      updatedAt: conv.timestamp ? new Date(conv.timestamp) : new Date(),
      lastMessage: conv.lastMessage ? {
        id: 'api-last',
        conversationId: conv.id,
        senderId: '',
        senderName: '',
        content: typeof conv.lastMessage === 'string' ? conv.lastMessage : conv.lastMessage.content || '',
        type: 'text' as const,
        timestamp: conv.timestamp ? new Date(conv.timestamp) : new Date(),
        status: 'read' as const,
      } : undefined,
    }));
    setConversations(transformedConversations);
  }, []);

  const updateGroupsFromApi = useCallback((apiGroups: any[]) => {
    // Transform API groups to the ChatContext format
    // Note: lastMessage from API is a string (the message content), not an object
    const transformedGroups: Conversation[] = apiGroups.map(group => ({
      id: group.id,
      type: 'group' as const,
      name: group.name,
      avatar: group.avatar,
      participants: [],
      unreadCount: group.unread || 0,
      typing: [],
      updatedAt: group.timestamp ? new Date(group.timestamp) : new Date(),
      lastMessage: group.lastMessage ? {
        id: 'api-last',
        conversationId: group.id,
        senderId: '',
        senderName: '',
        content: typeof group.lastMessage === 'string' ? group.lastMessage : group.lastMessage.content || '',
        type: 'text' as const,
        timestamp: group.timestamp ? new Date(group.timestamp) : new Date(),
        status: 'read' as const,
      } : undefined,
    }));
    setGroups(transformedGroups);
  }, []);

  const getConversation = useCallback((conversationId: string) => {
    return conversations.find(c => c.id === conversationId);
  }, [conversations]);

  const getMessages = useCallback((conversationId: string) => {
    return messages.get(conversationId) || [];
  }, [messages]);

  const getTotalUnreadCount = useCallback(() => {
    const conversationUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    const groupUnread = groups.reduce((sum, group) => sum + group.unreadCount, 0);
    return conversationUnread + groupUnread;
  }, [conversations, groups]);

  const value: ChatContextType = {
    conversations,
    groups,
    messages,
    loadingConversations,
    loadingMessages,
    connectionStatus,
    activeConversationId,
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    deleteMessage,
    setActiveConversation,
    updateConversationsFromApi,
    updateGroupsFromApi,
    getConversation,
    getMessages,
    getTotalUnreadCount,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
