import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '@/constants/api';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  timestamp: Date;
  replyTo?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  replyToSenderId?: string;
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
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  connect(token: string) {
    // If already connected, don't reconnect
    if (this.socket?.connected) {
      console.log('ChatService: Already connected, skipping');
      return;
    }

    // If there's an existing disconnected socket, clean it up
    if (this.socket) {
      console.log('ChatService: Cleaning up old disconnected socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Use Socket.IO URL from config (HTTP URL - Socket.IO handles WebSocket upgrade)
    const socketUrl = API_CONFIG.socketIOURL || API_CONFIG.baseURL.replace('/api/v1', '');

    // Debug: Log connection details
    console.log('=== ChatService: Initiating Socket.IO connection ===');
    console.log('ChatService: URL:', socketUrl);
    console.log('ChatService: Path: /socket.io/');
    console.log('ChatService: Token present:', !!token);
    console.log('ChatService: Token length:', token?.length);

    this.socket = io(socketUrl, {
      auth: { token },
      path: '/socket.io/',  // Socket.IO path on server
      transports: ['polling', 'websocket'],  // Allow polling as fallback, then upgrade
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,  // Connection timeout
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('=== ChatService: SOCKET CONNECTED ===');
      console.log('ChatService: Socket ID:', this.socket?.id);
      console.log('ChatService: Socket connected:', this.socket?.connected);
      this.reconnectAttempts = 0;
      this.emit('connection', { status: 'connected' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('=== ChatService: SOCKET DISCONNECTED ===');
      console.log('ChatService: Disconnect reason:', reason);
      this.emit('connection', { status: 'disconnected' });
    });

    this.socket.on('connect_error', (error: any) => {
      console.log('=== ChatService: CONNECTION ERROR ===');
      console.log('ChatService: Error:', error.message);

      // Stop retrying on 404 — server does not support Socket.IO (e.g. Vercel serverless)
      const httpStatus = error?.description ?? error?.context?.status;
      if (httpStatus === 404) {
        console.log('ChatService: Socket.IO endpoint not found (404). Stopping reconnection.');
        if (this.socket) {
          this.socket.io.reconnection(false);
          this.socket.disconnect();
        }
        return;
      }

      console.log('ChatService: Error details:', JSON.stringify(error, null, 2));
      console.log('ChatService: Socket state - connected:', this.socket?.connected, 'disconnected:', this.socket?.disconnected);
    });

    // Catch ALL events for debugging (dev only)
    if (__DEV__) {
      this.socket.onAny((eventName, ...args) => {
        console.log(`ChatService: Received event '${eventName}':`, JSON.stringify(args).substring(0, 200));
      });
    }

    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.emit('connection', { status: 'reconnecting', attempt });
    });

    // Message events
    this.socket.on('message:new', (data: any) => {
      console.log('ChatService: Received message:new event', JSON.stringify(data));
      // All data comes in camelCase now
      const message: Message = {
        id: data.id,
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        content: data.content,
        type: data.type || 'text',
        status: data.status || 'sent',
        timestamp: new Date(data.timestamp),
        replyTo: data.replyTo,
        replyToContent: data.replyToContent,
        replyToSenderName: data.replyToSenderName,
        replyToSenderId: data.replyToSenderId,
      };
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

    // Unread count update event
    this.socket.on('unread:update', (data: { conversationId: string; unreadCount: number }) => {
      console.log('ChatService: Received unread:update event', data);
      this.emit('unread:update', {
        conversationId: data.conversationId,
        unreadCount: data.unreadCount ?? 0,
      });
    });

    // Notification events (for buy orders, price alerts, etc.)
    this.socket.on('notification:new', (data: any) => {
      console.log('ChatService: Received notification:new event', data);
      this.emit('notification:new', data);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    // Don't clear listeners - they are managed by components and need to persist across reconnects
    // Components will call off() when they unmount
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
