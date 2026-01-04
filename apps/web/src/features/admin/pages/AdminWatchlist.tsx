import { useEffect, useState } from 'react'
import { Search, Trash2, Bell, BellOff, Eye, X, Plus, Edit2 } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

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

interface DefaultWatchlistItem {
  id: string
  brand: string
  model: string
  reference?: string
  item_type: 'want_to_buy' | 'want_to_sell' | 'watching'
  target_price?: number
  currency: string
  notes?: string
  is_active: boolean
  display_order: number
  created_by_id: string
  created_by_name: string
  created_at: string
  updated_at?: string
}

interface DefaultWatchlistFormData {
  brand: string
  model: string
  reference: string
  item_type: 'want_to_buy' | 'want_to_sell' | 'watching'
  target_price: number | null
  currency: string
  notes: string
  is_active: boolean
  display_order: number
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

const emptyDefaultForm: DefaultWatchlistFormData = {
  brand: '',
  model: '',
  reference: '',
  item_type: 'watching',
  target_price: null,
  currency: 'EUR',
  notes: '',
  is_active: true,
  display_order: 0,
}

export function AdminWatchlist() {
  const [activeTab, setActiveTab] = useState<'user' | 'default'>('user')

  // User watchlist state
  const [records, setRecords] = useState<WatchlistRecord[]>([])
  const [stats, setStats] = useState<WatchlistStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterBrand, setFilterBrand] = useState<string>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [viewingNotes, setViewingNotes] = useState<WatchlistRecord | null>(null)

  // Default watchlist state
  const [defaultItems, setDefaultItems] = useState<DefaultWatchlistItem[]>([])
  const [defaultLoading, setDefaultLoading] = useState(true)
  const [defaultSearchTerm, setDefaultSearchTerm] = useState('')
  const [showDefaultModal, setShowDefaultModal] = useState(false)
  const [editingDefault, setEditingDefault] = useState<DefaultWatchlistItem | null>(null)
  const [defaultFormData, setDefaultFormData] = useState<DefaultWatchlistFormData>(emptyDefaultForm)
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultOpenMenuId, setDefaultOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'user') {
      fetchRecords()
      fetchStats()
    } else {
      fetchDefaultItems()
    }
  }, [activeTab, filterType, filterBrand])

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

  const fetchDefaultItems = async () => {
    try {
      const response = await api.get('/default-watchlist/admin/default-watchlist')
      setDefaultItems(response.data)
    } catch (error) {
      console.error('Failed to fetch default watchlist items:', error)
    } finally {
      setDefaultLoading(false)
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

  const handleCreateDefault = () => {
    setEditingDefault(null)
    setDefaultFormData(emptyDefaultForm)
    setShowDefaultModal(true)
  }

  const handleEditDefault = (item: DefaultWatchlistItem) => {
    setEditingDefault(item)
    setDefaultFormData({
      brand: item.brand,
      model: item.model,
      reference: item.reference || '',
      item_type: item.item_type,
      target_price: item.target_price || null,
      currency: item.currency,
      notes: item.notes || '',
      is_active: item.is_active,
      display_order: item.display_order,
    })
    setShowDefaultModal(true)
    setDefaultOpenMenuId(null)
  }

  const handleDeleteDefault = async (id: string) => {
    if (!confirm('Are you sure you want to delete this default watchlist item?')) return

    try {
      await api.delete(`/default-watchlist/admin/default-watchlist/${id}`)
      fetchDefaultItems()
    } catch (error) {
      console.error('Failed to delete default item:', error)
    }
    setDefaultOpenMenuId(null)
  }

  const handleToggleDefaultActive = async (item: DefaultWatchlistItem) => {
    try {
      await api.post(`/default-watchlist/admin/default-watchlist/${item.id}/toggle-active`)
      fetchDefaultItems()
    } catch (error) {
      console.error('Failed to toggle active status:', error)
    }
    setDefaultOpenMenuId(null)
  }

  const handleSubmitDefault = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingDefault(true)

    try {
      const payload = {
        brand: defaultFormData.brand,
        model: defaultFormData.model,
        reference: defaultFormData.reference || undefined,
        item_type: defaultFormData.item_type,
        target_price: defaultFormData.target_price || undefined,
        currency: defaultFormData.currency,
        notes: defaultFormData.notes || undefined,
        is_active: defaultFormData.is_active,
        display_order: defaultFormData.display_order,
      }

      if (editingDefault) {
        await api.patch(`/default-watchlist/admin/default-watchlist/${editingDefault.id}`, payload)
      } else {
        await api.post('/default-watchlist/admin/default-watchlist', payload)
      }

      setShowDefaultModal(false)
      fetchDefaultItems()
    } catch (error) {
      console.error('Failed to save default item:', error)
    } finally {
      setSavingDefault(false)
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

  const filteredDefaultItems = defaultItems.filter((item) => {
    const searchLower = defaultSearchTerm.toLowerCase()
    return (
      item.brand.toLowerCase().includes(searchLower) ||
      item.model.toLowerCase().includes(searchLower) ||
      (item.reference && item.reference.toLowerCase().includes(searchLower))
    )
  })

  const uniqueBrands = [...new Set(records.map((r) => r.brand))].sort()

  if ((activeTab === 'user' && loading) || (activeTab === 'default' && defaultLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Watchlist Management</h1>
        <p className="text-gray-600">Manage user watchlists and default watchlist templates</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('user')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'user'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          User Watchlist Records
        </button>
        <button
          onClick={() => setActiveTab('default')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'default'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Default Watchlist (New Users)
        </button>
      </div>

      {activeTab === 'user' ? (
        <>
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
                        <ActionMenu
                          isOpen={openMenuId === record.id}
                          onToggle={() => setOpenMenuId(openMenuId === record.id ? null : record.id)}
                          onClose={() => setOpenMenuId(null)}
                        >
                          {record.notes && (
                            <ActionMenuItem
                              onClick={() => {
                                setViewingNotes(record)
                                setOpenMenuId(null)
                              }}
                              icon={<Eye className="w-4 h-4" />}
                            >
                              View Notes
                            </ActionMenuItem>
                          )}
                          <ActionMenuItem
                            onClick={() => {
                              handleDelete(record.id)
                              setOpenMenuId(null)
                            }}
                            variant="danger"
                            icon={<Trash2 className="w-4 h-4" />}
                          >
                            Delete
                          </ActionMenuItem>
                        </ActionMenu>
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
        </>
      ) : (
        <>
          {/* Default Watchlist Section */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search default items..."
                  value={defaultSearchTerm}
                  onChange={(e) => setDefaultSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
                />
              </div>
              <button
                onClick={handleCreateDefault}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Default Item
              </button>
            </div>

            <div className="p-4 bg-blue-50 border-b">
              <p className="text-sm text-blue-700">
                Default watchlist items are automatically added to new users' watchlists when they register.
                This helps onboard users with popular watches to track.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Watch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDefaultItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{item.display_order}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.brand}</p>
                          <p className="text-sm text-gray-500">{item.model}</p>
                          {item.reference && (
                            <p className="text-xs text-gray-400">Ref: {item.reference}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${ITEM_TYPE_COLORS[item.item_type]}`}>
                          {ITEM_TYPE_LABELS[item.item_type]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.target_price ? (
                          <span className="text-sm font-medium">
                            {item.currency} {item.target_price.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.created_by_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <ActionMenu
                          isOpen={defaultOpenMenuId === item.id}
                          onToggle={() => setDefaultOpenMenuId(defaultOpenMenuId === item.id ? null : item.id)}
                          onClose={() => setDefaultOpenMenuId(null)}
                        >
                          <ActionMenuItem
                            onClick={() => handleEditDefault(item)}
                            icon={<Edit2 className="w-4 h-4" />}
                          >
                            Edit
                          </ActionMenuItem>
                          <ActionMenuItem
                            onClick={() => handleToggleDefaultActive(item)}
                            icon={item.is_active ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          >
                            {item.is_active ? 'Deactivate' : 'Activate'}
                          </ActionMenuItem>
                          <ActionMenuItem
                            onClick={() => handleDeleteDefault(item.id)}
                            variant="danger"
                            icon={<Trash2 className="w-4 h-4" />}
                          >
                            Delete
                          </ActionMenuItem>
                        </ActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDefaultItems.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No default watchlist items found. Add items to automatically populate new users' watchlists.
              </div>
            )}
          </div>
        </>
      )}

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

      {/* Default Watchlist Modal */}
      {showDefaultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDefault ? 'Edit Default Item' : 'Add Default Watchlist Item'}
              </h2>
            </div>

            <form onSubmit={handleSubmitDefault} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={defaultFormData.brand}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Rolex"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={defaultFormData.model}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Submariner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={defaultFormData.reference}
                  onChange={(e) => setDefaultFormData({ ...defaultFormData, reference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., 126610LN"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={defaultFormData.item_type}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, item_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="watching">Watching</option>
                    <option value="want_to_buy">Want to Buy</option>
                    <option value="want_to_sell">Want to Sell</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={defaultFormData.display_order}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={defaultFormData.target_price || ''}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, target_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={defaultFormData.currency}
                    onChange={(e) => setDefaultFormData({ ...defaultFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={defaultFormData.notes}
                  onChange={(e) => setDefaultFormData({ ...defaultFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Optional notes about this watch..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={defaultFormData.is_active}
                  onChange={(e) => setDefaultFormData({ ...defaultFormData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active (will be added to new users' watchlists)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDefaultModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDefault}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingDefault ? 'Saving...' : (editingDefault ? 'Update Item' : 'Create Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
