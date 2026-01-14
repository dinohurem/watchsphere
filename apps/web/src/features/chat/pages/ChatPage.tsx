import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Send, X, Flag, Users, Reply, MessageSquare, CornerUpRight } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  customerId?: string;
}

function UserProfileModal({
  user,
  onClose
}: {
  user: UserProfile;
  onClose: () => void;
}) {
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
          {/* Avatar */}
          <div className="w-[100px] h-[100px] rounded-full overflow-hidden mb-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImagePlaceholder size={100} borderRadius={50} />
            )}
          </div>

          {/* Name */}
          <h2 className="text-[22px] font-semibold text-[#212121] tracking-[-0.22px] leading-[1.2] mb-1">
            {user.name}
          </h2>

          {/* Customer ID */}
          <p className="text-[15px] font-medium text-[#212121]/50 tracking-[0.075px] leading-[20px] mb-6">
            Customer ID: {user.customerId || user.id.slice(0, 8).toUpperCase()}
          </p>

          {/* Report Button */}
          <button className="flex items-center gap-2 px-5 py-3 rounded-full border border-[#D35741] text-[#D35741] hover:bg-[#D35741]/5 transition-colors">
            <Flag className="w-4 h-4" />
            <span className="text-[15px] font-semibold tracking-[0.075px] leading-[20px]">Report</span>
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
  memberCount?: number;
}

export function ChatPage() {
  const { recipientId } = useParams<{ recipientId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversationParam = searchParams.get('conversation');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          const response = await api.post('/chat/direct', {
            participant_id: recipientId,
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
    setInputText(`@${message.sender_name} `);
  };

  const handleReplyPrivately = async (message: Message) => {
    if (message.sender_id === currentUserId) return;
    try {
      const response = await api.post('/chat/direct', {
        participant_id: message.sender_id,
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
      type: 'group' as const,
      memberCount: g.memberCount,
    })),
  ];

  return (
    <div className="mx-24 py-6 bg-white h-[calc(100vh-64px)]">
      <div className="h-full overflow-hidden">
        <div className="flex h-full">
          {/* Left Sidebar - Chat List */}
          <div className="w-[280px] flex-shrink-0 flex flex-col">
            {/* Header */}
            <div className="px-4 py-4">
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
              <div
                key={`${chat.type}-${chat.id}`}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl transition-colors cursor-pointer ${
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
                    if (chat.type === 'direct') {
                      setSelectedUserProfile({
                        id: chat.id,
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
              </div>
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
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-[#1d1d1f]">
                    {selectedChat.name}
                  </h2>
                  <p className="text-base text-[#1d1d1f] opacity-50">
                    {selectedChat.type === 'group'
                      ? `${groupMembers.length > 0 ? groupMembers.length : (selectedChat.memberCount || 0)} members`
                      : 'Online'}
                  </p>
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
                <div className="flex-1 overflow-y-auto py-4 space-y-1">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === currentUserId;
                    const showAvatar = isLastMessageFromSender(index);
                    const senderMember = groupMembers.find(m => m.id === message.sender_id);

                    return (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 group ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        onMouseEnter={() => setHoveredMessageId(message.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
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
                                  <img src={senderMember.avatar} alt={message.sender_name} className="w-full h-full object-cover" />
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
                        {isOwnMessage && hoveredMessageId === message.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(message)}
                              className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                              title="Reply"
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

                        {/* Hover actions - right side for others' messages */}
                        {!isOwnMessage && hoveredMessageId === message.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReply(message)}
                              className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4 text-[#1d1d1f]" />
                            </button>
                            {selectedChat.type === 'group' && (
                              <>
                                <button
                                  onClick={() => handleReplyPrivately(message)}
                                  className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                                  title="Reply Privately"
                                >
                                  <CornerUpRight className="w-4 h-4 text-[#1d1d1f]" />
                                </button>
                                <button
                                  onClick={() => navigate(`/app/user/${message.sender_id}`)}
                                  className="w-8 h-8 rounded-full bg-[rgba(33,33,33,0.05)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.1)] transition-colors"
                                  title="View Profile"
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

        {/* User Profile Modal */}
        {selectedUserProfile && (
          <UserProfileModal
            user={selectedUserProfile}
            onClose={() => setSelectedUserProfile(null)}
          />
        )}

        {/* Group Members Modal */}
        {showGroupMembers && selectedChat?.type === 'group' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[420px] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 h-[60px] border-b border-[rgba(33,33,33,0.05)]">
                <h2 className="text-[18px] font-semibold text-[#212121]">
                  Group Members ({groupMembers.length})
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
                {groupMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setShowGroupMembers(false);
                      navigate(`/app/user/${member.id}`);
                    }}
                    className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[rgba(33,33,33,0.02)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#e5e5e5] flex items-center justify-center overflow-hidden">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-semibold text-[#1d1d1f]">
                          {getInitials(member.name)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[15px] font-medium text-[#212121]">{member.name}</p>
                      {member.id === currentUserId && (
                        <p className="text-[13px] text-[#212121]/50">You</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
