import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '@/constants/api';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  timestamp: Date;
  replyTo?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount: number;
  typing: string[]; // User IDs currently typing
  updatedAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
}

class ChatService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    // Use WebSocket URL from config, fallback to baseURL
    const socketUrl = API_CONFIG.wsURL || API_CONFIG.baseURL.replace('http', 'ws');

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Chat connected');
      this.reconnectAttempts = 0;
      this.emit('connection', { status: 'connected' });
    });

    this.socket.on('disconnect', () => {
      console.log('Chat disconnected');
      this.emit('connection', { status: 'disconnected' });
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.emit('connection', { status: 'reconnecting', attempt });
    });

    // Message events
    this.socket.on('message:new', (message: Message) => {
      this.emit('message:new', message);
    });

    this.socket.on('message:status', (data: { messageId: string; status: Message['status'] }) => {
      this.emit('message:status', data);
    });

    this.socket.on('message:deleted', (messageId: string) => {
      this.emit('message:deleted', messageId);
    });

    // Typing events
    this.socket.on('typing:start', (data: TypingIndicator) => {
      this.emit('typing:start', data);
    });

    this.socket.on('typing:stop', (data: TypingIndicator) => {
      this.emit('typing:stop', data);
    });

    // Conversation events
    this.socket.on('conversation:updated', (conversation: Conversation) => {
      this.emit('conversation:updated', conversation);
    });

    // Presence events
    this.socket.on('user:online', (userId: string) => {
      this.emit('user:online', userId);
    });

    this.socket.on('user:offline', (userId: string) => {
      this.emit('user:offline', userId);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
  }

  // Send message
  sendMessage(conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', replyTo?: string) {
    const tempId = `temp_${Date.now()}`;
    const message: Message = {
      id: tempId,
      conversationId,
      senderId: 'current_user', // Will be set by server
      senderName: 'You',
      content,
      type,
      status: 'sending',
      timestamp: new Date(),
      replyTo,
    };

    // Emit optimistically
    this.emit('message:new', message);

    this.socket?.emit('message:send', {
      conversationId,
      content,
      type,
      replyTo,
      tempId,
    }, (response: { success: boolean; message?: Message; error?: string }) => {
      if (response.success && response.message) {
        // Replace temp message with real one
        this.emit('message:replace', { tempId, message: response.message });
      } else {
        // Mark message as failed
        this.emit('message:failed', { tempId, error: response.error });
      }
    });

    return tempId;
  }

  // Mark messages as read
  markAsRead(conversationId: string, messageIds: string[]) {
    this.socket?.emit('messages:read', {
      conversationId,
      messageIds,
    });
  }

  // Typing indicators
  startTyping(conversationId: string) {
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.socket?.emit('typing:start', { conversationId });

    // Auto-stop after 3 seconds
    const timeout = setTimeout(() => {
      this.stopTyping(conversationId);
    }, 3000);

    this.typingTimeouts.set(conversationId, timeout);
  }

  stopTyping(conversationId: string) {
    const timeout = this.typingTimeouts.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(conversationId);
    }

    this.socket?.emit('typing:stop', { conversationId });
  }

  // Delete message
  deleteMessage(messageId: string) {
    this.socket?.emit('message:delete', { messageId });
  }

  // Join/leave conversation rooms
  joinConversation(conversationId: string) {
    this.socket?.emit('conversation:join', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('conversation:leave', { conversationId });
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const chatService = new ChatService();
