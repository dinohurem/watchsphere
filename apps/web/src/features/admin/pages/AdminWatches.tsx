import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, Star, StarOff, BookOpen, X } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface Watch {
  id: string
  brand: string
  model: string
  reference: string | null
  price: number
  currency: string
  condition: string
  year: number | null
  serial_number: string | null
  description: string | null
  images: string[]
  cover_image: string | null
  status: 'draft' | 'active' | 'sold' | 'reserved' | 'archived'
  featured: boolean
  dealer_id: string
  dealer_name: string | null
  views: number
  created_at: string
}

interface Order {
  id: string
  order_type: 'buy' | 'sell'
  brand: string
  model: string
  reference: string
  watch_id?: string
  price: number
  currency: string
  condition: 'Unworn' | 'Used'
  country_code: string
  country_name?: string
  user_id: string
  user_name?: string
  status: 'active' | 'completed' | 'cancelled' | 'expired'
  has_box: boolean
  has_papers: boolean
  notes?: string
  created_at: string
  updated_at?: string
}

interface OrderFormData {
  price: number
  condition: 'Unworn' | 'Used'
  has_box: boolean
  has_papers: boolean
  notes: string
  status: string
}

interface NewOrderFormData {
  order_type: 'buy' | 'sell'
  price: number
  currency: string
  condition: 'Unworn' | 'Used'
  country_code: string
  country_name: string
  has_box: boolean
  has_papers: boolean
  notes: string
  user_name: string
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  sold: 'bg-blue-100 text-blue-800',
  reserved: 'bg-amber-100 text-amber-800',
  archived: 'bg-red-100 text-red-800',
}

const orderStatusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  nos: 'NOS',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${orderStatusColors[status as keyof typeof orderStatusColors] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

interface WatchFormData {
  brand: string
  model: string
  reference: string
  price: number
  currency: string
  condition: string
  year: number | null
  serial_number: string
  description: string
  images: string[]
  cover_image: string
  status: string
  featured: boolean
}

const emptyForm: WatchFormData = {
  brand: '',
  model: '',
  reference: '',
  price: 0,
  currency: 'USD',
  condition: 'excellent',
  year: null,
  serial_number: '',
  description: '',
  images: [],
  cover_image: '',
  status: 'draft',
  featured: false,
}

const emptyOrderForm: OrderFormData = {
  price: 0,
  condition: 'Unworn',
  has_box: false,
  has_papers: false,
  notes: '',
  status: 'active',
}

const emptyNewOrderForm: NewOrderFormData = {
  order_type: 'sell',
  price: 0,
  currency: 'EUR',
  condition: 'Unworn',
  country_code: 'US',
  country_name: 'United States',
  has_box: false,
  has_papers: false,
  notes: '',
  user_name: '',
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'BE', name: 'Belgium' },
]

export function AdminWatches() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingWatch, setEditingWatch] = useState<Watch | null>(null)
  const [formData, setFormData] = useState<WatchFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Order Book state
  const [showOrderBook, setShowOrderBook] = useState(false)
  const [orderBookWatch, setOrderBookWatch] = useState<Watch | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderTab, setOrderTab] = useState<'buy' | 'sell'>('sell')
  const [orderMenuOpen, setOrderMenuOpen] = useState<string | null>(null)
  const [showOrderEditModal, setShowOrderEditModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [orderFormData, setOrderFormData] = useState<OrderFormData>(emptyOrderForm)
  const [savingOrder, setSavingOrder] = useState(false)
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [newOrderFormData, setNewOrderFormData] = useState<NewOrderFormData>(emptyNewOrderForm)
  const [creatingOrder, setCreatingOrder] = useState(false)

  useEffect(() => {
    fetchWatches()
  }, [])

  const fetchWatches = async () => {
    try {
      const response = await api.get('/market/admin/all')
      setWatches(response.data)
    } catch (error) {
      console.error('Failed to fetch watches:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async (reference: string) => {
    setOrdersLoading(true)
    try {
      const response = await api.get(`/orders/admin/by-reference/${encodeURIComponent(reference)}`)
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingWatch(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const handleEdit = (watch: Watch) => {
    setEditingWatch(watch)
    setFormData({
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference || '',
      price: watch.price,
      currency: watch.currency,
      condition: watch.condition,
      year: watch.year,
      serial_number: watch.serial_number || '',
      description: watch.description || '',
      images: watch.images,
      cover_image: watch.cover_image || '',
      status: watch.status,
      featured: watch.featured,
    })
    setShowModal(true)
    setActionMenuOpen(null)
  }

  const handleDelete = async (watchId: string) => {
    if (!confirm('Are you sure you want to delete this watch?')) return
    try {
      await api.delete(`/market/admin/${watchId}`)
      fetchWatches()
    } catch (error) {
      console.error('Failed to delete watch:', error)
    }
    setActionMenuOpen(null)
  }

  const handleToggleFeatured = async (watch: Watch) => {
    try {
      await api.patch(`/market/admin/${watch.id}`, { featured: !watch.featured })
      fetchWatches()
    } catch (error) {
      console.error('Failed to toggle featured:', error)
    }
    setActionMenuOpen(null)
  }

  const handleViewOrderBook = (watch: Watch) => {
    if (!watch.reference) {
      alert('This watch has no reference number. Order books are grouped by reference.')
      return
    }
    setOrderBookWatch(watch)
    setShowOrderBook(true)
    setOrderTab('sell')
    fetchOrders(watch.reference)
    setActionMenuOpen(null)
  }

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order)
    setOrderFormData({
      price: order.price,
      condition: order.condition,
      has_box: order.has_box,
      has_papers: order.has_papers,
      notes: order.notes || '',
      status: order.status,
    })
    setShowOrderEditModal(true)
    setOrderMenuOpen(null)
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    try {
      await api.patch(`/orders/admin/${orderId}`, { status: 'cancelled' })
      if (orderBookWatch?.reference) {
        fetchOrders(orderBookWatch.reference)
      }
    } catch (error) {
      console.error('Failed to cancel order:', error)
    }
    setOrderMenuOpen(null)
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to permanently delete this order?')) return
    try {
      await api.delete(`/orders/admin/${orderId}`)
      if (orderBookWatch?.reference) {
        fetchOrders(orderBookWatch.reference)
      }
    } catch (error) {
      console.error('Failed to delete order:', error)
    }
    setOrderMenuOpen(null)
  }

  const handleSubmitOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    setSavingOrder(true)

    try {
      await api.patch(`/orders/admin/${editingOrder.id}`, {
        price: orderFormData.price,
        condition: orderFormData.condition,
        has_box: orderFormData.has_box,
        has_papers: orderFormData.has_papers,
        notes: orderFormData.notes || undefined,
        status: orderFormData.status,
      })
      setShowOrderEditModal(false)
      if (orderBookWatch?.reference) {
        fetchOrders(orderBookWatch.reference)
      }
    } catch (error) {
      console.error('Failed to update order:', error)
    } finally {
      setSavingOrder(false)
    }
  }

  const handleOpenNewOrderModal = () => {
    setNewOrderFormData({
      ...emptyNewOrderForm,
      order_type: orderTab,
    })
    setShowNewOrderModal(true)
  }

  const handleSubmitNewOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderBookWatch?.reference) return
    setCreatingOrder(true)

    try {
      await api.post('/orders/admin/create', {
        order_type: newOrderFormData.order_type,
        brand: orderBookWatch.brand,
        model: orderBookWatch.model,
        reference: orderBookWatch.reference,
        watch_id: orderBookWatch.id,
        price: newOrderFormData.price,
        currency: newOrderFormData.currency,
        condition: newOrderFormData.condition,
        country_code: newOrderFormData.country_code,
        country_name: newOrderFormData.country_name,
        has_box: newOrderFormData.has_box,
        has_papers: newOrderFormData.has_papers,
        notes: newOrderFormData.notes || undefined,
        user_name: newOrderFormData.user_name || undefined,
      })
      setShowNewOrderModal(false)
      fetchOrders(orderBookWatch.reference)
    } catch (error) {
      console.error('Failed to create order:', error)
    } finally {
      setCreatingOrder(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        ...formData,
        year: formData.year || undefined,
        serial_number: formData.serial_number || undefined,
        reference: formData.reference || undefined,
        description: formData.description || undefined,
        cover_image: formData.cover_image || undefined,
      }

      if (editingWatch) {
        await api.patch(`/market/admin/${editingWatch.id}`, payload)
      } else {
        await api.post('/market/admin', payload)
      }

      setShowModal(false)
      fetchWatches()
    } catch (error) {
      console.error('Failed to save watch:', error)
    } finally {
      setSaving(false)
    }
  }

  const filteredWatches = watches.filter(watch => {
    const matchesSearch =
      watch.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      watch.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (watch.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesStatus = statusFilter === 'all' || watch.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredOrders = orders.filter(order => order.order_type === orderTab)

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
          <h1 className="text-2xl font-bold text-gray-900">Market (Watches)</h1>
          <p className="text-gray-600">Manage watch listings ({watches.length} total)</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Watch
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search watches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="reserved">Reserved</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Watch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredWatches.map((watch) => (
                <tr key={watch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {watch.cover_image ? (
                          <img src={watch.cover_image} alt={watch.model} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-gray-400 text-xs">No img</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{watch.brand}</span>
                          {watch.featured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="text-sm text-gray-500">{watch.model}</div>
                        {watch.reference && <div className="text-xs text-gray-400">Ref: {watch.reference}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {watch.currency} {watch.price.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 capitalize">
                      {conditionLabels[watch.condition] || watch.condition}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={watch.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Eye className="w-4 h-4 mr-1" />
                      {watch.views}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ActionMenu
                      isOpen={actionMenuOpen === watch.id}
                      onToggle={() => setActionMenuOpen(actionMenuOpen === watch.id ? null : watch.id)}
                      onClose={() => setActionMenuOpen(null)}
                    >
                      <ActionMenuItem
                        onClick={() => handleEdit(watch)}
                        icon={<Edit2 className="w-4 h-4" />}
                      >
                        Edit
                      </ActionMenuItem>
                      <ActionMenuItem
                        onClick={() => handleViewOrderBook(watch)}
                        icon={<BookOpen className="w-4 h-4" />}
                      >
                        View Order Book
                      </ActionMenuItem>
                      <ActionMenuItem
                        onClick={() => handleToggleFeatured(watch)}
                        icon={watch.featured ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                      >
                        {watch.featured ? 'Remove Featured' : 'Set Featured'}
                      </ActionMenuItem>
                      <ActionMenuItem
                        onClick={() => handleDelete(watch.id)}
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

        {filteredWatches.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No watches found matching your criteria
          </div>
        )}
      </div>

      {/* Watch Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingWatch ? 'Edit Watch' : 'Add New Watch'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Rolex"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Submariner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., 126610LN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="HKD">HKD</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                  <select
                    required
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="new">New</option>
                    <option value="nos">New Old Stock (NOS)</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                    <option value="reserved">Reserved</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <ImageUpload
                value={formData.cover_image || undefined}
                onChange={(url) => setFormData({ ...formData, cover_image: url || '' })}
                uploadEndpoint="/upload/market"
                label="Cover Image"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Describe the watch..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="h-4 w-4 text-primary border-gray-300 rounded"
                />
                <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
                  Featured watch (shown prominently in marketplace)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingWatch ? 'Update Watch' : 'Create Watch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Book Modal */}
      {showOrderBook && orderBookWatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Order Book</h2>
                <p className="text-sm text-gray-500">
                  {orderBookWatch.brand} {orderBookWatch.model} - Ref: {orderBookWatch.reference}
                </p>
              </div>
              <button
                onClick={() => setShowOrderBook(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b justify-between items-center">
              <div className="flex">
                <button
                  onClick={() => setOrderTab('sell')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    orderTab === 'sell'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sell Orders ({orders.filter(o => o.order_type === 'sell').length})
                </button>
                <button
                  onClick={() => setOrderTab('buy')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    orderTab === 'buy'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Buy Orders ({orders.filter(o => o.order_type === 'buy').length})
                </button>
              </div>
              <button
                onClick={handleOpenNewOrderModal}
                className="mr-4 flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Order
              </button>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto">
              {ordersLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No {orderTab} orders for this watch
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Box/Papers</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900">{order.user_name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${orderTab === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                            {order.currency} {order.price.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{order.condition}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <img
                              src={`https://flagcdn.com/16x12/${order.country_code.toLowerCase()}.png`}
                              alt={order.country_code}
                              className="w-4 h-3"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <span className="text-sm text-gray-600">{order.country_code}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {order.has_box && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Box</span>
                            )}
                            {order.has_papers && (
                              <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Papers</span>
                            )}
                            {!order.has_box && !order.has_papers && (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ActionMenu
                            isOpen={orderMenuOpen === order.id}
                            onToggle={() => setOrderMenuOpen(orderMenuOpen === order.id ? null : order.id)}
                            onClose={() => setOrderMenuOpen(null)}
                          >
                            <ActionMenuItem
                              onClick={() => handleEditOrder(order)}
                              icon={<Edit2 className="w-4 h-4" />}
                            >
                              Edit
                            </ActionMenuItem>
                            {order.status === 'active' && (
                              <ActionMenuItem
                                onClick={() => handleCancelOrder(order.id)}
                                icon={<X className="w-4 h-4" />}
                              >
                                Cancel
                              </ActionMenuItem>
                            )}
                            <ActionMenuItem
                              onClick={() => handleDeleteOrder(order.id)}
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
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowOrderBook(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Edit Modal */}
      {showOrderEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Order</h2>
              <p className="text-sm text-gray-500">{editingOrder.brand} {editingOrder.model}</p>
            </div>

            <form onSubmit={handleSubmitOrderEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={orderFormData.price}
                  onChange={(e) => setOrderFormData({ ...orderFormData, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={orderFormData.condition}
                    onChange={(e) => setOrderFormData({ ...orderFormData, condition: e.target.value as 'Unworn' | 'Used' })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="Unworn">Unworn</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={orderFormData.status}
                    onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_box"
                    checked={orderFormData.has_box}
                    onChange={(e) => setOrderFormData({ ...orderFormData, has_box: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="has_box" className="ml-2 text-sm text-gray-700">Has Box</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_papers"
                    checked={orderFormData.has_papers}
                    onChange={(e) => setOrderFormData({ ...orderFormData, has_papers: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="has_papers" className="ml-2 text-sm text-gray-700">Has Papers</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowOrderEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOrder}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingOrder ? 'Saving...' : 'Update Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && orderBookWatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Add New Order</h2>
              <p className="text-sm text-gray-500">
                {orderBookWatch.brand} {orderBookWatch.model} - Ref: {orderBookWatch.reference}
              </p>
            </div>

            <form onSubmit={handleSubmitNewOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="order_type"
                      value="sell"
                      checked={newOrderFormData.order_type === 'sell'}
                      onChange={() => setNewOrderFormData({ ...newOrderFormData, order_type: 'sell' })}
                      className="h-4 w-4 text-red-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Sell Order</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="order_type"
                      value="buy"
                      checked={newOrderFormData.order_type === 'buy'}
                      onChange={() => setNewOrderFormData({ ...newOrderFormData, order_type: 'buy' })}
                      className="h-4 w-4 text-green-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Buy Order</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newOrderFormData.price || ''}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., 12500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={newOrderFormData.currency}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                    <option value="HKD">HKD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                  <select
                    value={newOrderFormData.condition}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, condition: e.target.value as 'Unworn' | 'Used' })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="Unworn">Unworn</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <select
                    value={newOrderFormData.country_code}
                    onChange={(e) => {
                      const country = COUNTRIES.find(c => c.code === e.target.value)
                      setNewOrderFormData({
                        ...newOrderFormData,
                        country_code: e.target.value,
                        country_name: country?.name || e.target.value,
                      })
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Name (optional)</label>
                <input
                  type="text"
                  value={newOrderFormData.user_name}
                  onChange={(e) => setNewOrderFormData({ ...newOrderFormData, user_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Leave empty to use admin account"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="new_has_box"
                    checked={newOrderFormData.has_box}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, has_box: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="new_has_box" className="ml-2 text-sm text-gray-700">Has Box</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="new_has_papers"
                    checked={newOrderFormData.has_papers}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, has_papers: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="new_has_papers" className="ml-2 text-sm text-gray-700">Has Papers</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={newOrderFormData.notes}
                  onChange={(e) => setNewOrderFormData({ ...newOrderFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrder || !newOrderFormData.price}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {creatingOrder ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
