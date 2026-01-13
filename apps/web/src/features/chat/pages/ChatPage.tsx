import { useState, useEffect, useRef } from 'react';
import { Image, Send } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface Conversation {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string | null;
  timestamp?: string;
  unread: number;
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
}

interface ChatItem {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string | null;
  timestamp?: string;
  unread: number;
  type: 'direct' | 'group';
}

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations and groups
  useEffect(() => {
    loadConversations();
    loadGroups();
    loadCurrentUser();
  }, []);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id, selectedChat.type);
    }
  }, [selectedChat]);

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
      const response = await api.get(endpoint);
      if (response.data) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedChat || isSending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedChat.id,
      sender_id: currentUserId,
      sender_name: 'You',
      content: messageContent,
      type: 'text',
      is_ai: false,
      read: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const endpoint = selectedChat.type === 'group'
        ? `/chat/groups/${selectedChat.id}/messages`
        : `/chat/conversations/${selectedChat.id}/messages`;

      const response = await api.post(endpoint, { content: messageContent });

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
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      type: 'group' as const
    })),
  ];

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto h-[calc(100vh-120px)]">
        <div className="flex h-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Left Sidebar - Chat List */}
          <div className="w-[335px] flex-shrink-0 flex flex-col">
            {/* Header */}
            <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">Chat</h1>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {allChats.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No conversations yet
            </div>
          ) : (
            allChats.map((chat) => (
              <button
                key={`${chat.type}-${chat.id}`}
                onClick={() => setSelectedChat(chat)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl transition-colors ${
                  selectedChat?.id === chat.id && selectedChat?.type === chat.type
                    ? 'bg-[#f4f4f4]'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar */}
                {chat.avatar ? (
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <ImagePlaceholder size={32} borderRadius={16} />
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-medium text-[#1d1d1f] truncate leading-tight">
                    {chat.name}
                  </p>
                  <p className="text-base text-[#1d1d1f] opacity-50 truncate leading-tight">
                    {chat.lastMessage || '—'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

          {/* Divider */}
          <div className="w-px bg-[rgba(0,0,0,0.1)]" />

          {/* Right Side - Chat Area */}
          <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-8 pt-8 pb-4 border-b border-[rgba(33,33,33,0.04)]">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-[#1d1d1f]">
                  {selectedChat.name}
                </h2>
                <p className="text-base text-[#1d1d1f] opacity-50">
                  {selectedChat.type === 'group' ? 'Group chat' : 'Online'}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col px-8 overflow-hidden">
              {/* Date */}
              <div className="text-center py-4">
                <span className="text-[13px] text-[#1d1d1f] opacity-50">Today</span>
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
                      Start the conversation
                    </p>
                    <p className="text-sm text-[#212121] opacity-50 leading-5 tracking-[0.07px]">
                      Ask about pricing, availability, or condition.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  {messages.map((message) => {
                    const isOwnMessage = message.sender_id === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            isOwnMessage
                              ? 'bg-[#212121] text-white'
                              : 'bg-[rgba(33,33,33,0.04)] text-[#212121]'
                          }`}
                        >
                          {!isOwnMessage && selectedChat.type === 'group' && (
                            <p className="text-xs font-medium opacity-70 mb-1">
                              {message.sender_name}
                            </p>
                          )}
                          <p className="text-[15px] leading-5">{message.content}</p>
                          <p className={`text-[11px] mt-1 ${isOwnMessage ? 'text-white/60' : 'text-[#212121]/50'}`}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Input Area */}
              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 flex items-center bg-[rgba(33,33,33,0.04)] rounded-full px-4 py-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Send message..."
                    className="flex-1 bg-transparent text-[15px] text-[#212121] placeholder:text-[#212121]/50 outline-none"
                  />
                </div>
                <button className="w-11 h-11 rounded-full bg-[#f1f1f1] flex items-center justify-center hover:bg-gray-200 transition-colors">
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
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Select a conversation</h2>
              <p className="text-[#1d1d1f] opacity-50">Choose a conversation from the list to start chatting</p>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
