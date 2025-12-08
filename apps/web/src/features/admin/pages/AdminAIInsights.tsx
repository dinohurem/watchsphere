import { useEffect, useState } from 'react'
import { MessageSquare, User, Bot, Search, Eye, X, RefreshCw, Calendar } from 'lucide-react'
import { api } from '@/services/api'

interface AIConversation {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  title?: string
  message_count: number
  created_at: string
  last_message_at?: string
}

interface AIMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_name?: string
  content: string
  is_ai: boolean
  created_at: string
}

interface AIStats {
  period_days: number
  total_conversations: number
  recent_conversations: number
  total_messages: number
  ai_messages: number
  user_messages: number
  unique_users: number
  avg_messages_per_chat: number
  conversations_by_day: Record<string, number>
}

interface WhatsAppReference {
  id: string
  brand?: string
  reference?: string
  price?: number
  currency: string
  condition?: string
  seller_name?: string
  raw_text: string
  message_timestamp?: string
}

export function AdminAIInsights() {
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [stats, setStats] = useState<AIStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDays, setFilterDays] = useState<number>(30)
  const [showReferences, setShowReferences] = useState(false)
  const [references, setReferences] = useState<WhatsAppReference[]>([])
  const [referencesLoading, setReferencesLoading] = useState(false)
  const [refSearchTerm, setRefSearchTerm] = useState('')

  useEffect(() => {
    fetchConversations()
    fetchStats()
  }, [filterDays])

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams()
      params.append('days', filterDays.toString())
      params.append('limit', '100')

      const response = await api.get(`/insights/admin/insights/ai-chats?${params.toString()}`)
      setConversations(response.data)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get(`/insights/admin/insights/ai-chats/stats?days=${filterDays}`)
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleViewMessages = async (conversation: AIConversation) => {
    setSelectedConversation(conversation)
    setMessagesLoading(true)

    try {
      const response = await api.get(`/insights/admin/insights/ai-chats/${conversation.id}/messages`)
      setMessages(response.data)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSearchReferences = async () => {
    if (!refSearchTerm.trim()) {
      setReferences([])
      return
    }

    setReferencesLoading(true)
    try {
      const params = new URLSearchParams()
      // Try to determine if it's a brand or reference search
      if (refSearchTerm.match(/^[A-Z0-9-]+$/i)) {
        params.append('reference', refSearchTerm)
      } else {
        params.append('brand', refSearchTerm)
      }
      params.append('limit', '20')

      const response = await api.get(`/insights/admin/insights/references?${params.toString()}`)
      setReferences(response.data.references)
    } catch (error) {
      console.error('Failed to search references:', error)
    } finally {
      setReferencesLoading(false)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (conv.user_name && conv.user_name.toLowerCase().includes(searchLower)) ||
      (conv.user_email && conv.user_email.toLowerCase().includes(searchLower)) ||
      (conv.title && conv.title.toLowerCase().includes(searchLower))
    )
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Chat Insights</h1>
          <p className="text-gray-600">View and analyze all AI chat conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReferences(!showReferences)}
            className={`px-4 py-2 rounded-lg border ${
              showReferences ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            WhatsApp References
          </button>
          <button
            onClick={() => {
              setLoading(true)
              fetchConversations()
              fetchStats()
            }}
            className="p-2 hover:bg-gray-100 rounded-lg border"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Total Conversations</p>
            <p className="text-2xl font-bold">{stats.total_conversations}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Recent ({stats.period_days} days)</p>
            <p className="text-2xl font-bold text-blue-600">{stats.recent_conversations}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Total Messages</p>
            <p className="text-2xl font-bold text-green-600">{stats.total_messages}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Unique Users</p>
            <p className="text-2xl font-bold text-purple-600">{stats.unique_users}</p>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Message Distribution</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-blue-500" />
                  User Messages
                </span>
                <span className="font-semibold">{stats.user_messages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Bot className="w-4 h-4 text-green-500" />
                  AI Responses
                </span>
                <span className="font-semibold">{stats.ai_messages}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-gray-500">Avg per chat</span>
                <span className="font-semibold">{stats.avg_messages_per_chat}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4 col-span-2">
            <h3 className="font-semibold mb-3">Conversations by Day</h3>
            <div className="flex items-end gap-1 h-20">
              {Object.entries(stats.conversations_by_day).slice(-14).map(([day, count]) => {
                const maxCount = Math.max(...Object.values(stats.conversations_by_day))
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <div
                    key={day}
                    className="flex-1 bg-primary rounded-t"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${day}: ${count} conversations`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>14 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp References Panel */}
      {showReferences && (
        <div className="bg-white rounded-lg border shadow-sm mb-6">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">WhatsApp Market References</h2>
            <p className="text-sm text-gray-500">Search imported WhatsApp data for price validation</p>
          </div>
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by brand or reference..."
                  value={refSearchTerm}
                  onChange={(e) => setRefSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchReferences()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleSearchReferences}
                disabled={referencesLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {referencesLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {references.length > 0 && (
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {references.map((ref) => (
                  <div key={ref.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{ref.brand || 'Unknown'}</span>
                        {ref.reference && (
                          <span className="ml-2 text-sm text-gray-500 font-mono">{ref.reference}</span>
                        )}
                      </div>
                      {ref.price && (
                        <span className="font-medium text-green-600">
                          {ref.currency} {ref.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{ref.raw_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by user name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={filterDays}
              onChange={(e) => setFilterDays(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        {/* Conversations List */}
        <div className="divide-y">
          {filteredConversations.map((conv) => (
            <div key={conv.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {conv.user_name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">{conv.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{conv.message_count} messages</p>
                    <p className="text-xs text-gray-500">
                      {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : 'No messages'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewMessages(conv)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                    title="View conversation"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {conv.title && (
                <p className="text-sm text-gray-600 mt-2 ml-11">{conv.title}</p>
              )}
              <div className="flex items-center gap-4 mt-2 ml-11 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Started: {formatDate(conv.created_at)}
                </span>
              </div>
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No AI chat conversations found
            </div>
          )}
        </div>
      </div>

      {/* Messages Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">AI Chat Conversation</h2>
                <p className="text-sm text-gray-500">
                  {selectedConversation.user_name || 'Unknown User'} - {selectedConversation.message_count} messages
                </p>
              </div>
              <button onClick={() => setSelectedConversation(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_ai ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.is_ai
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-primary text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.is_ai ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.sender_name || (msg.is_ai ? 'AI Assistant' : 'User')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.is_ai ? 'text-gray-400' : 'text-white/70'}`}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {!messagesLoading && messages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No messages in this conversation
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setSelectedConversation(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
