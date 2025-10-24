import { create } from 'zustand';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  read: boolean;
  type: 'text' | 'image' | 'file';
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  type: 'direct' | 'group' | 'ai';
  name?: string;
  avatar?: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  totalUnread: number;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  markAsRead: (conversationId: string) => void;
  setActiveConversation: (conversationId: string | null) => void;
  updateUnreadCount: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  totalUnread: 0,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) => set((state) => ({
    conversations: [...state.conversations, conversation],
  })),

  setMessages: (conversationId, messages) => set((state) => ({
    messages: { ...state.messages, [conversationId]: messages },
  })),

  addMessage: (message) => set((state) => ({
    messages: {
      ...state.messages,
      [message.conversationId]: [
        ...(state.messages[message.conversationId] || []),
        message,
      ],
    },
  })),

  markAsRead: (conversationId) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    ),
  })),

  setActiveConversation: (conversationId) => set({
    activeConversationId: conversationId
  }),

  updateUnreadCount: () => set((state) => ({
    totalUnread: state.conversations.reduce(
      (acc, conv) => acc + conv.unreadCount,
      0
    ),
  })),
}));
