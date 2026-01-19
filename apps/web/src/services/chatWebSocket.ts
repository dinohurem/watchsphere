/**
 * WebSocket service for real-time chat functionality
 */

import { API_CONFIG } from '../config/api';

export interface WebSocketMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  timestamp: string;
  replyTo?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  replyToSenderId?: string;
  tempId?: string;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  online: boolean;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  reference?: string;
  orderId?: string;
  price?: number;
  currency?: string;
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string;
  createdAt: string;
}

type MessageHandler = (message: WebSocketMessage) => void;
type TypingHandler = (data: TypingIndicator) => void;
type PresenceHandler = (data: PresenceUpdate) => void;
type ConnectionHandler = (status: 'connected' | 'disconnected' | 'reconnecting') => void;
type NotificationHandler = (data: NotificationData) => void;

class ChatWebSocketService {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Event handlers
  private onMessageHandlers: MessageHandler[] = [];
  private onTypingHandlers: TypingHandler[] = [];
  private onPresenceHandlers: PresenceHandler[] = [];
  private onConnectionHandlers: ConnectionHandler[] = [];
  private onMessageReadHandlers: ((data: { conversationId: string; messageIds: string[]; readerId: string }) => void)[] = [];
  private onUnreadUpdateHandlers: ((data: { conversationId: string; unreadCount: number }) => void)[] = [];
  private onNotificationHandlers: NotificationHandler[] = [];

  connect(token: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.token = token;
    const wsUrl = `${API_CONFIG.wsURL}?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.notifyConnectionHandlers('connected');
      this.startPingInterval();
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.notifyConnectionHandlers('disconnected');
      this.stopPingInterval();

      // Auto-reconnect if not intentionally closed
      if (event.code !== 1000 && event.code !== 4001) {
        this.handleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  private handleMessage(data: { type: string; data: any }): void {
    switch (data.type) {
      case 'connection':
        console.log('Connection confirmed:', data.data);
        break;

      case 'message:new':
        this.onMessageHandlers.forEach(handler => handler(data.data));
        break;

      case 'typing':
        this.onTypingHandlers.forEach(handler => handler(data.data));
        break;

      case 'user:presence':
        this.onPresenceHandlers.forEach(handler => handler(data.data));
        break;

      case 'message:read':
        this.onMessageReadHandlers.forEach(handler => handler(data.data));
        break;

      case 'unread:update':
        this.onUnreadUpdateHandlers.forEach(handler => handler(data.data));
        break;

      case 'notification:new':
        this.onNotificationHandlers.forEach(handler => handler(data.data));
        break;

      case 'conversation:joined':
        console.log('Joined conversation:', data.data.conversation_id);
        break;

      case 'message:failed':
        console.error('Message failed:', data.data);
        break;

      case 'error':
        console.error('WebSocket error:', data.data);
        break;

      case 'pong':
        // Keep-alive response received
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.notifyConnectionHandlers('reconnecting');

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', data: {} });
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.token = null;
    this.reconnectAttempts = 0;
  }

  private send(data: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  // Join a conversation to receive messages
  joinConversation(conversationId: string): void {
    this.send({
      type: 'conversation:join',
      data: { conversationId }
    });
  }

  // Leave a conversation
  leaveConversation(conversationId: string): void {
    this.send({
      type: 'conversation:leave',
      data: { conversationId }
    });
  }

  // Send a message
  sendMessage(conversationId: string, content: string, tempId?: string, replyTo?: string): void {
    this.send({
      type: 'message:send',
      data: {
        conversationId,
        content,
        tempId,
        replyTo
      }
    });
  }

  // Notify typing started
  startTyping(conversationId: string): void {
    this.send({
      type: 'typing:start',
      data: { conversationId }
    });
  }

  // Notify typing stopped
  stopTyping(conversationId: string): void {
    this.send({
      type: 'typing:stop',
      data: { conversationId }
    });
  }

  // Mark messages as read
  markAsRead(conversationId: string, messageIds: string[]): void {
    this.send({
      type: 'messages:read',
      data: { conversationId, messageIds }
    });
  }

  // Event handler registration
  onMessage(handler: MessageHandler): () => void {
    this.onMessageHandlers.push(handler);
    return () => {
      const index = this.onMessageHandlers.indexOf(handler);
      if (index > -1) this.onMessageHandlers.splice(index, 1);
    };
  }

  onTyping(handler: TypingHandler): () => void {
    this.onTypingHandlers.push(handler);
    return () => {
      const index = this.onTypingHandlers.indexOf(handler);
      if (index > -1) this.onTypingHandlers.splice(index, 1);
    };
  }

  onPresence(handler: PresenceHandler): () => void {
    this.onPresenceHandlers.push(handler);
    return () => {
      const index = this.onPresenceHandlers.indexOf(handler);
      if (index > -1) this.onPresenceHandlers.splice(index, 1);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.onConnectionHandlers.push(handler);
    return () => {
      const index = this.onConnectionHandlers.indexOf(handler);
      if (index > -1) this.onConnectionHandlers.splice(index, 1);
    };
  }

  onMessageRead(handler: (data: { conversationId: string; messageIds: string[]; readerId: string }) => void): () => void {
    this.onMessageReadHandlers.push(handler);
    return () => {
      const index = this.onMessageReadHandlers.indexOf(handler);
      if (index > -1) this.onMessageReadHandlers.splice(index, 1);
    };
  }

  onUnreadUpdate(handler: (data: { conversationId: string; unreadCount: number }) => void): () => void {
    this.onUnreadUpdateHandlers.push(handler);
    return () => {
      const index = this.onUnreadUpdateHandlers.indexOf(handler);
      if (index > -1) this.onUnreadUpdateHandlers.splice(index, 1);
    };
  }

  onNotification(handler: NotificationHandler): () => void {
    this.onNotificationHandlers.push(handler);
    return () => {
      const index = this.onNotificationHandlers.indexOf(handler);
      if (index > -1) this.onNotificationHandlers.splice(index, 1);
    };
  }

  private notifyConnectionHandlers(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    this.onConnectionHandlers.forEach(handler => handler(status));
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const chatWebSocket = new ChatWebSocketService();
