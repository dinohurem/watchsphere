import { useEffect, useState } from 'react'
import { Search, Trash2, Bell, BellOff, MoreVertical, Eye, X } from 'lucide-react'
import { api } from '@/services/api'

interface WatchlistRecord {
  id: string
  user_id: string
  user_name: string
  user_email: string
  item_type: 'want_to_buy' | 'want_to_sell' | 'watching'
  watch_id?: string
  brand: string
  model: string
  reference?: string
  target_price?: number
  currency: string
  price_alert_enabled: boolean
  notes?: string
  is_active: boolean
  created_at: string
}

interface WatchlistStats {
  total_records: number
  active_records: number
  by_type: Record<string, number>
  top_brands: Record<string, number>
  active_alerts: number
  unique_users: number
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  want_to_buy: 'Want to Buy',
  want_to_sell: 'Want to Sell',
  watching: 'Watching',
}

const ITEM_TYPE_COLORS: Record<string, string> = {
  want_to_buy: 'bg-green-100 text-green-800',
  want_to_sell: 'bg-blue-100 text-blue-800',
  watching: 'bg-gray-100 text-gray-800',
}

export function AdminWatchlist() {
  const [records, setRecords] = useState<WatchlistRecord[]>([])
  const [stats, setStats] = useState<WatchlistStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterBrand, setFilterBrand] = useState<string>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [viewingNotes, setViewingNotes] = useState<WatchlistRecord | null>(null)

  useEffect(() => {
    fetchRecords()
    fetchStats()
  }, [filterType, filterBrand])

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.append('item_type', filterType)
      if (filterBrand) params.append('brand', filterBrand)

      const response = await api.get(`/watchlist/admin/watchlist?${params.toString()}`)
      setRecords(response.data)
    } catch (error) {
      console.error('Failed to fetch watchlist records:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/watchlist/admin/watchlist/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watchlist record?')) return

    try {
      await api.delete(`/watchlist/admin/watchlist/${id}`)
      fetchRecords()
      fetchStats()
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  const filteredRecords = records.filter((record) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      record.brand.toLowerCase().includes(searchLower) ||
      record.model.toLowerCase().includes(searchLower) ||
      record.user_name.toLowerCase().includes(searchLower) ||
      record.user_email.toLowerCase().includes(searchLower) ||
      (record.reference && record.reference.toLowerCase().includes(searchLower))
    )
  })

  const uniqueBrands = [...new Set(records.map((r) => r.brand))].sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Watchlist Records</h1>
        <p className="text-gray-600">View all user watchlist records and alerts</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Total Records</p>
            <p className="text-2xl font-bold">{stats.total_records}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Active Records</p>
            <p className="text-2xl font-bold text-green-600">{stats.active_records}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Active Alerts</p>
            <p className="text-2xl font-bold text-amber-600">{stats.active_alerts}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Unique Users</p>
            <p className="text-2xl font-bold text-blue-600">{stats.unique_users}</p>
          </div>
        </div>
      )}

      {/* Type Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">By Type</h3>
            <div className="space-y-2">
              {Object.entries(stats.by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${ITEM_TYPE_COLORS[type] || 'bg-gray-100'}`}>
                    {ITEM_TYPE_LABELS[type] || type}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Top Brands</h3>
            <div className="space-y-2">
              {Object.entries(stats.top_brands).slice(0, 5).map(([brand, count]) => (
                <div key={brand} className="flex items-center justify-between">
                  <span className="text-gray-700">{brand}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm mb-6">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by brand, model, user..."
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
                <option value="want_to_buy">Want to Buy</option>
                <option value="want_to_sell">Want to Sell</option>
                <option value="watching">Watching</option>
              </select>
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Brands</option>
                {uniqueBrands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Watch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{record.user_name}</p>
                      <p className="text-sm text-gray-500">{record.user_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${ITEM_TYPE_COLORS[record.item_type]}`}>
                      {ITEM_TYPE_LABELS[record.item_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{record.brand}</p>
                      <p className="text-sm text-gray-500">{record.model}</p>
                      {record.reference && (
                        <p className="text-xs text-gray-400">Ref: {record.reference}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {record.target_price ? (
                      <span className="font-medium">
                        {record.currency} {record.target_price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.price_alert_enabled ? (
                      <Bell className="w-5 h-5 text-amber-500" />
                    ) : (
                      <BellOff className="w-5 h-5 text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      record.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {record.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(record.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === record.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border z-10">
                          {record.notes && (
                            <button
                              onClick={() => {
                                setViewingNotes(record)
                                setOpenMenuId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Notes
                            </button>
                          )}
                          <button
                            onClick={() => {
                              handleDelete(record.id)
                              setOpenMenuId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No watchlist records found
            </div>
          )}
        </div>
      </div>

      {/* Notes Modal */}
      {viewingNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Watchlist Notes</h2>
              <button onClick={() => setViewingNotes(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-gray-500">User</p>
                <p className="font-medium">{viewingNotes.user_name}</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Watch</p>
                <p className="font-medium">{viewingNotes.brand} {viewingNotes.model}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="bg-gray-50 rounded p-3 text-gray-700">{viewingNotes.notes}</p>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setViewingNotes(null)}
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
