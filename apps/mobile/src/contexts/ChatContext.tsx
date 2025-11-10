import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { chatService, Conversation, Message, TypingIndicator } from '@/services/chatService';
import { useAuthStore } from '@watchsphere/shared/stores';

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
  messages: Map<string, Message[]>;
  loadingConversations: boolean;
  loadingMessages: Map<string, boolean>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';

  // Methods
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, replyTo?: string) => void;
  markAsRead: (conversationId: string, messageIds: string[]) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  deleteMessage: (messageId: string) => void;

  // Getters
  getConversation: (conversationId: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getTotalUnreadCount: () => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState<Map<string, boolean>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Connect to chat service when user logs in
  useEffect(() => {
    if (user && token) {
      chatService.connect(token);
      loadConversations();

      // Request notification permissions if available
      if (Notifications && Notifications.requestPermissionsAsync) {
        Notifications.requestPermissionsAsync().catch((err: any) => {
          console.log('Failed to request notification permissions:', err);
        });
      }
    }

    return () => {
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
      setMessages(prev => {
        const convMessages = prev.get(message.conversationId) || [];

        // Check if message already exists
        const exists = convMessages.some(m => m.id === message.id);
        if (exists) return prev;

        const newMap = new Map(prev);
        newMap.set(message.conversationId, [...convMessages, message]);
        return newMap;
      });

      // Update conversation's last message
      setConversations(prev => prev.map(conv => {
        if (conv.id === message.conversationId) {
          return {
            ...conv,
            lastMessage: message,
            unreadCount: message.senderId !== user?.id ? conv.unreadCount + 1 : conv.unreadCount,
            updatedAt: message.timestamp,
          };
        }
        return conv;
      }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));

      // Show notification if message is from someone else and app is in background
      if (message.senderId !== user?.id) {
        showNotification(message);
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
      // API call to load conversations
      // const response = await api.get('/conversations');
      // setConversations(response.data);

      // Mock data for now
      const mockConversations: Conversation[] = [
        {
          id: '1',
          type: 'direct',
          name: 'John Dealer',
          participants: [
            { id: '1', name: 'John Dealer', online: true }
          ],
          unreadCount: 2,
          typing: [],
          updatedAt: new Date(),
        },
        {
          id: '2',
          type: 'group',
          name: 'Rolex Enthusiasts',
          participants: Array.from({ length: 500 }, (_, i) => ({
            id: `user_${i}`,
            name: `User ${i}`,
            online: Math.random() > 0.5,
          })),
          unreadCount: 5,
          typing: [],
          updatedAt: new Date(),
        },
      ];
      setConversations(mockConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(prev => new Map(prev).set(conversationId, true));
    try {
      // API call to load messages
      // const response = await api.get(`/conversations/${conversationId}/messages`);
      // setMessages(prev => new Map(prev).set(conversationId, response.data));

      // Mock data for now
      const mockMessages: Message[] = [];
      setMessages(prev => new Map(prev).set(conversationId, mockMessages));

      // Join conversation room
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

  const getConversation = useCallback((conversationId: string) => {
    return conversations.find(c => c.id === conversationId);
  }, [conversations]);

  const getMessages = useCallback((conversationId: string) => {
    return messages.get(conversationId) || [];
  }, [messages]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  const value: ChatContextType = {
    conversations,
    messages,
    loadingConversations,
    loadingMessages,
    connectionStatus,
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    deleteMessage,
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
