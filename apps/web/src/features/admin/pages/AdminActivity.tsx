import { useEffect, useState } from 'react'
import { Search, User, Watch, ShoppingCart, MessageSquare, Shield, RefreshCw, Monitor, Smartphone, Star, AlertTriangle, HelpCircle } from 'lucide-react'
import { api } from '@/services/api'

interface ActivityLog {
  id: string
  user_id?: string
  user_name?: string
  user_email?: string
  activity_type: string
  description: string
  entity_type?: string
  entity_id?: string
  metadata: Record<string, unknown>
  ip_address?: string
  platform?: string
  created_at: string
}

interface ActivityStats {
  period_days: number
  total_events: number
  by_type: Record<string, number>
  by_day: Record<string, number>
  top_users: Record<string, number>
  unique_users: number
}

const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user_registered: User,
  user_approved: User,
  user_rejected: User,
  user_login: User,
  watch_listed: Watch,
  watch_updated: Watch,
  watch_deleted: Watch,
  buy_order_placed: ShoppingCart,
  sell_order_placed: ShoppingCart,
  order_confirmed: ShoppingCart,
  transaction_completed: ShoppingCart,
  conversation_started: MessageSquare,
  ai_chat_session: MessageSquare,
  admin_action: Shield,
  review_created: Star,
  review_updated: Star,
  review_deleted: Star,
  dispute_created: AlertTriangle,
  dispute_updated: AlertTriangle,
  issue_created: HelpCircle,
  issue_updated: HelpCircle,
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  user_registered: 'bg-blue-100 text-blue-800',
  user_approved: 'bg-green-100 text-green-800',
  user_rejected: 'bg-red-100 text-red-800',
  user_login: 'bg-gray-100 text-gray-800',
  watch_listed: 'bg-purple-100 text-purple-800',
  watch_updated: 'bg-purple-100 text-purple-800',
  watch_deleted: 'bg-red-100 text-red-800',
  buy_order_placed: 'bg-green-100 text-green-800',
  sell_order_placed: 'bg-blue-100 text-blue-800',
  order_confirmed: 'bg-green-100 text-green-800',
  transaction_completed: 'bg-green-100 text-green-800',
  conversation_started: 'bg-indigo-100 text-indigo-800',
  ai_chat_session: 'bg-indigo-100 text-indigo-800',
  admin_action: 'bg-amber-100 text-amber-800',
  review_created: 'bg-yellow-100 text-yellow-800',
  review_updated: 'bg-yellow-100 text-yellow-800',
  review_deleted: 'bg-red-100 text-red-800',
  dispute_created: 'bg-orange-100 text-orange-800',
  dispute_updated: 'bg-orange-100 text-orange-800',
  issue_created: 'bg-pink-100 text-pink-800',
  issue_updated: 'bg-pink-100 text-pink-800',
}

const PLATFORM_COLORS: Record<string, string> = {
  web: 'bg-blue-100 text-blue-800',
  mobile: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  user_registered: 'User Registered',
  user_approved: 'User Approved',
  user_rejected: 'User Rejected',
  user_login: 'User Login',
  watch_listed: 'Watch Listed',
  watch_updated: 'Watch Updated',
  watch_deleted: 'Watch Deleted',
  buy_order_placed: 'Buy Order',
  sell_order_placed: 'Sell Order',
  order_confirmed: 'Order Confirmed',
  order_cancelled: 'Order Cancelled',
  transaction_completed: 'Transaction',
  watchlist_added: 'Watchlist Added',
  watchlist_removed: 'Watchlist Removed',
  conversation_started: 'Chat Started',
  ai_chat_session: 'AI Chat',
  admin_action: 'Admin Action',
  review_created: 'Review Created',
  review_updated: 'Review Updated',
  review_deleted: 'Review Deleted',
  dispute_created: 'Dispute Created',
  dispute_updated: 'Dispute Updated',
  issue_created: 'Issue Created',
  issue_updated: 'Issue Updated',
}

export function AdminActivity() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterPlatform, setFilterPlatform] = useState<string>('')
  const [filterDays, setFilterDays] = useState<number>(7)

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [filterType, filterPlatform, filterDays])

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.append('activity_type', filterType)
      if (filterPlatform) params.append('platform', filterPlatform)
      if (filterDays) params.append('days', filterDays.toString())
      params.append('limit', '200')

      const response = await api.get(`/activity/admin/activity?${params.toString()}`)
      setLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get(`/activity/admin/activity/stats?days=${filterDays}`)
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    fetchLogs()
    fetchStats()
  }

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      log.description.toLowerCase().includes(searchLower) ||
      (log.user_name && log.user_name.toLowerCase().includes(searchLower)) ||
      (log.user_email && log.user_email.toLowerCase().includes(searchLower)) ||
      log.activity_type.toLowerCase().includes(searchLower)
    )
  })

  const getActivityIcon = (type: string) => {
    const Icon = ACTIVITY_TYPE_ICONS[type] || Shield
    return Icon
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
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
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600">Track all major events and actions in the platform</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Total Events ({stats.period_days} days)</p>
            <p className="text-2xl font-bold">{stats.total_events}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Unique Users</p>
            <p className="text-2xl font-bold text-blue-600">{stats.unique_users}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Avg Events/Day</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.period_days > 0 ? Math.round(stats.total_events / stats.period_days) : 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Event Types</p>
            <p className="text-2xl font-bold text-purple-600">{Object.keys(stats.by_type).length}</p>
          </div>
        </div>
      )}

      {/* Stats Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Activity by Type</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(stats.by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${ACTIVITY_TYPE_COLORS[type] || 'bg-gray-100'}`}>
                      {ACTIVITY_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Top Active Users</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(stats.top_users).map(([user, count]) => (
                <div key={user} className="flex items-center justify-between">
                  <span className="text-gray-700">{user}</span>
                  <span className="font-semibold">{count} events</span>
                </div>
              ))}
              {Object.keys(stats.top_users).length === 0 && (
                <p className="text-gray-500 text-sm">No user activity in this period</p>
              )}
            </div>
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
                placeholder="Search activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Types</option>
                <optgroup label="User">
                  <option value="user_registered">User Registered</option>
                  <option value="user_approved">User Approved</option>
                  <option value="user_rejected">User Rejected</option>
                  <option value="user_login">User Login</option>
                </optgroup>
                <optgroup label="Watches">
                  <option value="watch_listed">Watch Listed</option>
                  <option value="watch_updated">Watch Updated</option>
                  <option value="watch_deleted">Watch Deleted</option>
                </optgroup>
                <optgroup label="Orders">
                  <option value="buy_order_placed">Buy Order</option>
                  <option value="sell_order_placed">Sell Order</option>
                  <option value="order_confirmed">Order Confirmed</option>
                  <option value="transaction_completed">Transaction</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="conversation_started">Chat Started</option>
                  <option value="ai_chat_session">AI Chat</option>
                  <option value="admin_action">Admin Action</option>
                </optgroup>
              </select>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Platforms</option>
                <option value="web">Web</option>
                <option value="mobile">Mobile</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filterDays}
                onChange={(e) => setFilterDays(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="divide-y divide-gray-100">
          {filteredLogs.map((log) => {
            const Icon = getActivityIcon(log.activity_type)
            return (
              <div key={log.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${ACTIVITY_TYPE_COLORS[log.activity_type] || 'bg-gray-100'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{log.description}</p>
                      <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                        {formatTimestamp(log.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      {log.user_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_name}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTIVITY_TYPE_COLORS[log.activity_type] || 'bg-gray-100'}`}>
                        {ACTIVITY_TYPE_LABELS[log.activity_type] || log.activity_type.replace(/_/g, ' ')}
                      </span>
                      {log.entity_type && (
                        <span className="text-xs text-gray-400">
                          {log.entity_type}: {log.entity_id?.slice(0, 8)}...
                        </span>
                      )}
                      {log.platform && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${PLATFORM_COLORS[log.platform] || 'bg-gray-100 text-gray-800'}`}>
                          {log.platform === 'mobile' ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <Monitor className="w-3 h-3" />
                          )}
                          {log.platform}
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="text-xs text-gray-400">
                          IP: {log.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No activity found for the selected filters
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
