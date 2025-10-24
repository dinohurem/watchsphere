import { MessageSquare, Search, Bot } from 'lucide-react';

export function ChatPage() {
  const conversations = [
    { id: '1', name: 'John Smith', lastMessage: 'Sure, the watch is available', time: '2m ago', unread: 2, type: 'dealer' },
    { id: '2', name: 'AI Assistant', lastMessage: 'How can I help you today?', time: '1h ago', unread: 0, type: 'ai' },
    { id: '3', name: 'Watch Dealers Group', lastMessage: 'Anyone selling a Submariner?', time: '3h ago', unread: 5, type: 'group' },
  ];

  return (
    <div className="flex h-full">
      {/* Conversations List */}
      <div className="w-full lg:w-96 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Chats</h1>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              className="w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                conv.type === 'ai' ? 'bg-purple-100' : 'bg-primary'
              }`}>
                {conv.type === 'ai' ? (
                  <Bot className="w-6 h-6 text-purple-600" />
                ) : (
                  <span className="text-white font-semibold">
                    {conv.name.charAt(0)}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">{conv.name}</h3>
                  <span className="text-xs text-gray-500">{conv.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                  {conv.unread > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area - Placeholder */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h2>
          <p className="text-gray-600">Choose a conversation from the list to start chatting</p>
        </div>
      </div>
    </div>
  );
}
