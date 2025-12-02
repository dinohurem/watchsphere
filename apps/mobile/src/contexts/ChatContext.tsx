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

      // Mock data for now - different messages for different conversation types
      let mockMessages: Message[] = [];

      if (conversationId === '1') {
        // Direct chat with user - messages with bubbles
        mockMessages = [
          {
            id: 'm1',
            conversationId: '1',
            senderId: '1',
            senderName: 'John Dealer',
            content: 'Hi! I saw your Rolex Submariner listing. Is it still available?',
            type: 'text',
            timestamp: new Date(Date.now() - 3600000),
            status: 'read',
          },
          {
            id: 'm2',
            conversationId: '1',
            senderId: 'current_user',
            senderName: 'You',
            content: 'Yes, it is! It\'s in excellent condition with all original papers and box.',
            type: 'text',
            timestamp: new Date(Date.now() - 3500000),
            status: 'read',
          },
          {
            id: 'm3',
            conversationId: '1',
            senderId: '1',
            senderName: 'John Dealer',
            content: 'Great! What\'s your best price on it? I\'m a serious buyer.',
            type: 'text',
            timestamp: new Date(Date.now() - 3400000),
            status: 'read',
          },
          {
            id: 'm4',
            conversationId: '1',
            senderId: 'current_user',
            senderName: 'You',
            content: 'I can do €12,000. That\'s already a great deal for this condition.',
            type: 'text',
            timestamp: new Date(Date.now() - 3300000),
            status: 'read',
          },
          {
            id: 'm5',
            conversationId: '1',
            senderId: '1',
            senderName: 'John Dealer',
            content: 'Deal. How can I make the payment?',
            type: 'text',
            timestamp: new Date(Date.now() - 600000),
            status: 'delivered',
          },
        ];
      } else if (conversationId === '2' || conversationId === 'g1') {
        // Group chat - messages with bubbles and sender names
        mockMessages = [
          {
            id: 'g1',
            conversationId: '2',
            senderId: 'user_1',
            senderName: 'Mike Johnson',
            content: 'Hey everyone! Just picked up a new Submariner Date. The quality is incredible!',
            type: 'text',
            timestamp: new Date(Date.now() - 7200000),
            status: 'read',
          },
          {
            id: 'g2',
            conversationId: '2',
            senderId: 'user_2',
            senderName: 'Sarah Chen',
            content: 'Congrats Mike! Which reference did you get?',
            type: 'text',
            timestamp: new Date(Date.now() - 7100000),
            status: 'read',
          },
          {
            id: 'g3',
            conversationId: '2',
            senderId: 'user_1',
            senderName: 'Mike Johnson',
            content: 'The 126610LN. Been waiting for this for months!',
            type: 'text',
            timestamp: new Date(Date.now() - 7000000),
            status: 'read',
          },
          {
            id: 'g4',
            conversationId: '2',
            senderId: 'current_user',
            senderName: 'You',
            content: 'That\'s awesome! How\'s the build quality compared to previous models?',
            type: 'text',
            timestamp: new Date(Date.now() - 6900000),
            status: 'read',
          },
          {
            id: 'g5',
            conversationId: '2',
            senderId: 'user_3',
            senderName: 'David Smith',
            content: 'Great discussion about the new releases!',
            type: 'text',
            timestamp: new Date(Date.now() - 900000),
            status: 'delivered',
          },
        ];
      } else if (conversationId.startsWith('ai')) {
        // AI chat - messages without bubbles for AI responses
        mockMessages = [
          {
            id: 'ai1',
            conversationId: conversationId,
            senderId: 'current_user',
            senderName: 'You',
            content: 'What\'s the reason for the price spike of Nautilus 5711?',
            type: 'text',
            timestamp: new Date(Date.now() - 1800000),
            status: 'read',
          },
          {
            id: 'ai2',
            conversationId: conversationId,
            senderId: 'ai_assistant',
            senderName: 'AI Assistant',
            content: 'Here\'s the short version:\n\nWhy the Patek Philippe Nautilus 5711 spiked in price\n\n1. Discontinuation: Patek officially stopped producing the steel 5711 in 2021, making existing pieces instantly rarer.\n\n2. Extreme scarcity: Even before that, demand far exceeded supply — long waitlists and limited production.\n\n3. Hype & status: Celebrity ownership, social media buzz, and its reputation as the luxury steel sports watch fueled desire.\n\n4. Speculation: Collectors and investors treated it like an asset, driving up resale values.\n\n5. Brand strategy: Patek replaced it with the costlier gold 5811, reinforcing the 5711\'s exclusivity.\n\nIn short: limited supply + massive hype + discontinuation = price explosion.',
            type: 'text',
            timestamp: new Date(Date.now() - 1780000),
            status: 'read',
          },
        ];
      }

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
