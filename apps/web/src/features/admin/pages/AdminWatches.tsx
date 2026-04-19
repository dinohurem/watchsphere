import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, Star, StarOff, BookOpen, X, Download, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface Watch {
  id: string
  brand: string
  model: string
  reference: string | null
  collection: string | null
  oem_references: string[]
  dial: string | null
  bracelet: string | null
  ws_code: string | null
  aliases: string[]
  price: number
  currency: string
  condition: string
  year: number | null
  serial_number: string | null
  description: string | null
  images: string[]
  cover_image: string | null
  status: 'draft' | 'active'
  featured: boolean
  is_popular_search: boolean
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
  status: 'draft' | 'active' | 'completed'
  has_box: boolean
  has_papers: boolean
  notes?: string
  remarks?: string
  created_at: string
  updated_at?: string
}

interface OrderFormData {
  order_type: 'buy' | 'sell'
  brand: string
  model: string
  reference: string
  collection: string
  oem_references: string[]
  dial: string
  bracelet: string
  ws_code: string
  aliases: string[]
  description: string
  price: number
  currency: string
  date: string
  condition: 'Unworn' | 'Used'
  country_code: string
  country_name: string
  notes: string
  user_name: string
  whatsapp_phone: string
  status: string
}

interface NewOrderFormData {
  order_type: 'buy' | 'sell'
  brand: string
  model: string
  reference: string
  collection: string
  oem_references: string[]
  dial: string
  bracelet: string
  ws_code: string
  aliases: string[]
  description: string
  price: number
  currency: string
  date: string
  condition: 'Unworn' | 'Used'
  country_code: string
  country_name: string
  notes: string
  user_name: string
  whatsapp_phone: string
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
}

const orderStatusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
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
  collection: string
  oem_references: string[]
  dial: string
  bracelet: string
  ws_code: string
  aliases: string[]
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
  collection: '',
  oem_references: [],
  dial: '',
  bracelet: '',
  ws_code: '',
  aliases: [],
  description: '',
  images: [],
  cover_image: '',
  status: 'draft',
  featured: false,
}

const CURRENCIES = [
  { code: 'EUR', label: 'EUR' },
  { code: 'USD', label: 'USD' },
  { code: 'GBP', label: 'GBP' },
  { code: 'CHF', label: 'CHF' },
  { code: 'HKD', label: 'HKD' },
  { code: 'SGD', label: 'SGD' },
  { code: 'JPY', label: 'JPY' },
  { code: 'AED', label: 'AED' },
  { code: 'CAD', label: 'CAD' },
  { code: 'AUD', label: 'AUD' },
]

const emptyOrderForm: OrderFormData = {
  order_type: 'sell',
  brand: '',
  model: '',
  reference: '',
  collection: '',
  oem_references: [],
  dial: '',
  bracelet: '',
  ws_code: '',
  aliases: [],
  description: '',
  price: 0,
  currency: 'EUR',
  date: '',
  condition: 'Unworn',
  country_code: 'CH',
  country_name: 'Switzerland',
  notes: '',
  user_name: '',
  whatsapp_phone: '',
  status: 'active',
}

const emptyNewOrderForm: NewOrderFormData = {
  order_type: 'sell',
  brand: '',
  model: '',
  reference: '',
  collection: '',
  oem_references: [],
  dial: '',
  bracelet: '',
  ws_code: '',
  aliases: [],
  description: '',
  price: 0,
  currency: 'EUR',
  date: '',
  condition: 'Unworn',
  country_code: 'CH',
  country_name: 'Switzerland',
  notes: '',
  user_name: '',
  whatsapp_phone: '',
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
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [oemRefInput, setOemRefInput] = useState('')
  const [aliasInput, setAliasInput] = useState('')
  const [watchDetailsOpen, setWatchDetailsOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchWatches()
    fetchTotalCount()
  }, [page, pageSize, searchTerm, statusFilter])

  // Reset to first page when search or filter changes
  useEffect(() => {
    setPage(0)
  }, [searchTerm, statusFilter])

  const fetchWatches = async () => {
    try {
      const params: Record<string, any> = { skip: page * pageSize, limit: pageSize }
      if (searchTerm) params.search = searchTerm
      if (statusFilter !== 'all') params.status_filter = statusFilter
      const response = await api.get('/market/admin/all', { params })
      setWatches(response.data)
    } catch (error) {
      console.error('Failed to fetch watches:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTotalCount = async () => {
    try {
      const params: Record<string, any> = {}
      if (searchTerm) params.search = searchTerm
      if (statusFilter !== 'all') params.status_filter = statusFilter
      const response = await api.get('/market/admin/count', { params })
      setTotalCount(response.data.total)
    } catch (error) {
      console.error('Failed to fetch count:', error)
    }
  }

  const fetchOrders = async (reference: string, wsCode?: string) => {
    setOrdersLoading(true)
    try {
      const params = wsCode ? `?ws_code=${encodeURIComponent(wsCode)}` : ''
      const response = await api.get(`/orders/admin/by-reference/${encodeURIComponent(reference)}${params}`)
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
      collection: watch.collection || '',
      oem_references: watch.oem_references || [],
      dial: watch.dial || '',
      bracelet: watch.bracelet || '',
      ws_code: watch.ws_code || '',
      aliases: watch.aliases || [],
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

  const handleTogglePopularSearch = async (watch: Watch) => {
    try {
      await api.post(`/market/admin/${watch.id}/toggle-popular-search`)
      fetchWatches()
    } catch (error) {
      console.error('Failed to toggle popular search:', error)
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
    fetchOrders(watch.reference, watch.ws_code || undefined)
    setActionMenuOpen(null)
  }

  const handleAddOrderDirect = (watch: Watch) => {
    if (!watch.reference) {
      alert('This watch has no reference number. Order books are grouped by reference.')
      return
    }
    setOrderBookWatch(watch)
    setShowOrderBook(true)
    setOrderTab('sell')
    fetchOrders(watch.reference, watch.ws_code || undefined)
    // Open the new order modal immediately
    setNewOrderFormData({
      ...emptyNewOrderForm,
      order_type: 'sell',
      brand: watch.brand || '',
      model: watch.model || '',
      reference: watch.reference || '',
      collection: watch.collection || '',
      oem_references: watch.oem_references || [],
      dial: watch.dial || '',
      bracelet: watch.bracelet || '',
      ws_code: watch.ws_code || '',
      aliases: watch.aliases || [],
      description: watch.description || '',
    })
    setWatchDetailsOpen(false)
    setShowNewOrderModal(true)
    setActionMenuOpen(null)
  }

  const handleExportCsv = async (reference: string) => {
    try {
      const response = await api.get(`/orders/admin/export-csv?reference=${encodeURIComponent(reference)}`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${reference}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export CSV:', error)
    }
  }

  const handleExportJsonl = async () => {
    try {
      const response = await api.get('/market/admin/export', {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'watches_export.jsonl')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export watches:', error)
    }
  }

  const handleAddOemRef = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = oemRefInput.trim()
      if (val && !formData.oem_references.includes(val)) {
        setFormData({ ...formData, oem_references: [...formData.oem_references, val] })
      }
      setOemRefInput('')
    }
  }

  const handleRemoveOemRef = (ref: string) => {
    setFormData({ ...formData, oem_references: formData.oem_references.filter(r => r !== ref) })
  }

  const handleAddAlias = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = aliasInput.trim()
      if (val && !formData.aliases.includes(val)) {
        setFormData({ ...formData, aliases: [...formData.aliases, val] })
      }
      setAliasInput('')
    }
  }

  const handleRemoveAlias = (alias: string) => {
    setFormData({ ...formData, aliases: formData.aliases.filter(a => a !== alias) })
  }

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order)
    // Format created_at to MM/YY for date field
    let dateStr = ''
    if (order.created_at) {
      const d = new Date(order.created_at)
      if (!isNaN(d.getTime())) {
        const mm = (d.getMonth() + 1).toString().padStart(2, '0')
        const yy = d.getFullYear().toString().slice(-2)
        dateStr = `${mm}/${yy}`
      }
    }
    setOrderFormData({
      order_type: order.order_type,
      brand: order.brand || orderBookWatch?.brand || '',
      model: order.model || orderBookWatch?.model || '',
      reference: order.reference || orderBookWatch?.reference || '',
      collection: (order as any).collection || orderBookWatch?.collection || '',
      oem_references: (order as any).oem_references || orderBookWatch?.oem_references || [],
      dial: (order as any).dial || orderBookWatch?.dial || '',
      bracelet: (order as any).bracelet || orderBookWatch?.bracelet || '',
      ws_code: (order as any).ws_code || orderBookWatch?.ws_code || '',
      aliases: (order as any).aliases || orderBookWatch?.aliases || [],
      description: (order as any).description || orderBookWatch?.description || '',
      price: order.price,
      currency: order.currency || 'EUR',
      date: dateStr,
      condition: order.condition,
      country_code: order.country_code || 'CH',
      country_name: order.country_name || 'Switzerland',
      notes: order.notes || '',
      user_name: order.user_name || '',
      whatsapp_phone: (order as any).whatsapp_phone || '',
      status: order.status,
    })
    setWatchDetailsOpen(false)
    setShowOrderEditModal(true)
    setOrderMenuOpen(null)
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return
    try {
      await api.patch(`/orders/admin/${orderId}`, { status: 'completed' })
      if (orderBookWatch?.reference) {
        fetchOrders(orderBookWatch.reference, orderBookWatch.ws_code || undefined)
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
        fetchOrders(orderBookWatch.reference, orderBookWatch.ws_code || undefined)
      }
    } catch (error) {
      console.error('Failed to delete order:', error)
    }
    setOrderMenuOpen(null)
  }

  const parseDateToISO = (dateStr: string): string | undefined => {
    if (!dateStr) return undefined
    const trimmed = dateStr.trim()
    // MM/YY format
    if (/^\d{2}\/\d{2}$/.test(trimmed)) {
      const [mm, yy] = trimmed.split('/')
      return new Date(2000 + parseInt(yy), parseInt(mm) - 1, 1).toISOString()
    }
    // YYYY format
    if (/^\d{4}$/.test(trimmed)) {
      return new Date(parseInt(trimmed), 0, 1).toISOString()
    }
    return undefined
  }

  const handleSubmitOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    setSavingOrder(true)

    const createdAt = parseDateToISO(orderFormData.date)

    try {
      await api.patch(`/orders/admin/${editingOrder.id}`, {
        order_type: orderFormData.order_type,
        brand: orderFormData.brand,
        model: orderFormData.model,
        reference: orderFormData.reference,
        collection: orderFormData.collection || undefined,
        oem_references: orderFormData.oem_references,
        dial: orderFormData.dial || undefined,
        bracelet: orderFormData.bracelet || undefined,
        ws_code: orderFormData.ws_code || undefined,
        aliases: orderFormData.aliases,
        description: orderFormData.description || undefined,
        price: orderFormData.price,
        currency: orderFormData.currency,
        condition: orderFormData.condition,
        country_code: orderFormData.country_code,
        country_name: orderFormData.country_name,
        notes: orderFormData.notes || undefined,
        user_name: orderFormData.user_name || undefined,
        whatsapp_phone: orderFormData.whatsapp_phone || undefined,
        status: orderFormData.status,
        ...(createdAt && { created_at: createdAt }),
      })
      setShowOrderEditModal(false)
      if (orderBookWatch?.reference) {
        fetchOrders(orderBookWatch.reference, orderBookWatch.ws_code || undefined)
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
      brand: orderBookWatch?.brand || '',
      model: orderBookWatch?.model || '',
      reference: orderBookWatch?.reference || '',
      collection: orderBookWatch?.collection || '',
      oem_references: orderBookWatch?.oem_references || [],
      dial: orderBookWatch?.dial || '',
      bracelet: orderBookWatch?.bracelet || '',
      ws_code: orderBookWatch?.ws_code || '',
      aliases: orderBookWatch?.aliases || [],
      description: orderBookWatch?.description || '',
    })
    setWatchDetailsOpen(false)
    setShowNewOrderModal(true)
  }

  const handleSubmitNewOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderBookWatch?.reference) return
    setCreatingOrder(true)

    const createdAt = parseDateToISO(newOrderFormData.date)

    try {
      await api.post('/orders/admin/create', {
        order_type: newOrderFormData.order_type,
        brand: newOrderFormData.brand,
        model: newOrderFormData.model,
        reference: newOrderFormData.reference || orderBookWatch.reference,
        watch_id: orderBookWatch.id,
        price: newOrderFormData.price,
        currency: newOrderFormData.currency,
        condition: newOrderFormData.condition,
        country_code: newOrderFormData.country_code,
        country_name: newOrderFormData.country_name,
        notes: newOrderFormData.notes || undefined,
        user_name: newOrderFormData.user_name || undefined,
        whatsapp_phone: newOrderFormData.whatsapp_phone || undefined,
        collection: newOrderFormData.collection || undefined,
        oem_references: newOrderFormData.oem_references,
        dial: newOrderFormData.dial || undefined,
        bracelet: newOrderFormData.bracelet || undefined,
        ws_code: newOrderFormData.ws_code || undefined,
        aliases: newOrderFormData.aliases,
        description: newOrderFormData.description || undefined,
        ...(createdAt && { created_at: createdAt }),
      })
      setShowNewOrderModal(false)
      fetchOrders(orderBookWatch.reference, orderBookWatch.ws_code || undefined)
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
        reference: formData.reference || undefined,
        collection: formData.collection || undefined,
        oem_references: formData.oem_references.length > 0 ? formData.oem_references : undefined,
        dial: formData.dial || undefined,
        bracelet: formData.bracelet || undefined,
        ws_code: formData.ws_code || undefined,
        aliases: formData.aliases.length > 0 ? formData.aliases : undefined,
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

  // Search and status filtering is now done server-side
  const filteredWatches = watches

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
          <p className="text-gray-600">Manage watch listings ({totalCount} total)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (!confirm('Generate missing thumbnails for all watches? This may take a moment.')) return
              try {
                const res = await api.post('/admin/watches/generate-thumbnails')
                alert(`Thumbnails: ${res.data.processed} generated, ${res.data.failed} failed (${res.data.total_missing} missing)`)
              } catch (error) {
                console.error('Failed to generate thumbnails:', error)
                alert('Failed to generate thumbnails')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
          >
            Generate Thumbnails
          </button>
          <button
            onClick={async () => {
              if (!confirm('Populate USD prices for all orders without one? This uses the Frankfurter API for conversion.')) return
              try {
                const res = await api.post('/orders/admin/bulk-update-usd-prices')
                alert(res.data.message || 'USD prices updated')
              } catch (error) {
                console.error('Failed to update USD prices:', error)
                alert('Failed to update USD prices')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Populate USD Prices
          </button>
          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to delete ALL orders? This cannot be undone.')) return
              try {
                const res = await api.delete('/orders/admin/bulk/all')
                alert(res.data.message || 'All orders deleted')
                if (showOrderBook && orderBookWatch?.reference) {
                  fetchOrders(orderBookWatch.reference, orderBookWatch.ws_code || undefined)
                }
              } catch (error) {
                console.error('Failed to delete all orders:', error)
                alert('Failed to delete all orders')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            Delete All Orders
          </button>
          <button
            onClick={handleExportJsonl}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            Export JSONL
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Add Watch
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search watches..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                searchTimerRef.current = setTimeout(() => {
                  setSearchTerm(e.target.value)
                }, 300)
              }}
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
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image + Brand/Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WS-Code</th>
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
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-gray-100">
                        {watch.cover_image ? (
                          <img src={watch.cover_image} alt={watch.model} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-gray-400 text-xs">No img</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{watch.brand}</span>
                        </div>
                        <div className="text-sm text-gray-500">{watch.model}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {watch.reference || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {watch.ws_code || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={watch.status} />
                      {watch.featured && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        </span>
                      )}
                      {watch.is_popular_search && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                          <Search className="w-3 h-3 text-blue-600" />
                        </span>
                      )}
                    </div>
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
                        onClick={() => handleAddOrderDirect(watch)}
                        icon={<PlusCircle className="w-4 h-4" />}
                      >
                        Add Order
                      </ActionMenuItem>
                      <ActionMenuItem
                        onClick={() => handleToggleFeatured(watch)}
                        icon={watch.featured ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                      >
                        {watch.featured ? 'Remove Featured' : 'Set Featured'}
                      </ActionMenuItem>
                      <ActionMenuItem
                        onClick={() => handleTogglePopularSearch(watch)}
                        icon={watch.is_popular_search ? <StarOff className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                      >
                        {watch.is_popular_search ? 'Remove Popular Search' : 'Set Popular Search'}
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

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 mb-2 px-4 py-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
            </p>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
            >
              <option value={20}>20 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
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
              {/* Row 1: Brand, Model */}
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

              {/* Row 2: Collection, WS-Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                  <input
                    type="text"
                    value={formData.collection}
                    onChange={(e) => setFormData({ ...formData, collection: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Submariner Date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WS-Code</label>
                  <input
                    type="text"
                    value={formData.ws_code}
                    onChange={(e) => setFormData({ ...formData, ws_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., WS-ROL-SUB-001"
                  />
                </div>
              </div>

              {/* Row 3: OEM-References (tag input), Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OEM-References</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {formData.oem_references.map((ref) => (
                      <span key={ref} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {ref}
                        <button type="button" onClick={() => handleRemoveOemRef(ref)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={oemRefInput}
                    onChange={(e) => setOemRefInput(e.target.value)}
                    onKeyDown={handleAddOemRef}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Type and press Enter to add"
                  />
                </div>
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
              </div>

              {/* Row 4: Dial, Bracelet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dial</label>
                  <input
                    type="text"
                    value={formData.dial}
                    onChange={(e) => setFormData({ ...formData, dial: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bracelet</label>
                  <input
                    type="text"
                    value={formData.bracelet}
                    onChange={(e) => setFormData({ ...formData, bracelet: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Oyster"
                  />
                </div>
              </div>

              {/* Row 5: Aliases (tag input) — full width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aliases</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {formData.aliases.map((alias) => (
                    <span key={alias} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {alias}
                      <button type="button" onClick={() => handleRemoveAlias(alias)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={handleAddAlias}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Type and press Enter to add"
                />
              </div>

              {/* Row 6: Photo */}
              <ImageUpload
                value={formData.cover_image || undefined}
                onChange={(url) => setFormData({ ...formData, cover_image: url || '' })}
                uploadEndpoint="/upload/market"
                label="Photo"
              />

              {/* Row 7: Description */}
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

              {/* Row 8: Status, Featured */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
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
                </div>
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
              <div className="flex items-center gap-2">
                {orderBookWatch.ws_code && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete all orders for ${orderBookWatch.brand} ${orderBookWatch.model}?`)) return
                      try {
                        const res = await api.delete(`/orders/admin/bulk/ws-code/${encodeURIComponent(orderBookWatch.ws_code!)}`)
                        alert(res.data.message || 'Orders deleted')
                        fetchOrders(orderBookWatch.reference!, orderBookWatch.ws_code || undefined)
                      } catch (error) {
                        console.error('Failed to delete orders:', error)
                        alert('Failed to delete orders')
                      }
                    }}
                    className="flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Orders
                  </button>
                )}
                <button
                  onClick={() => orderBookWatch.reference && handleExportCsv(orderBookWatch.reference)}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowOrderBook(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                  WTS ({orders.filter(o => o.order_type === 'sell').length})
                </button>
                <button
                  onClick={() => setOrderTab('buy')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    orderTab === 'buy'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  WTB ({orders.filter(o => o.order_type === 'buy').length})
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
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
                            {order.price != null ? `${order.currency} ${order.price.toLocaleString()}` : '—'}
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
                          {order.remarks ? (
                            <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded max-w-[140px] truncate" title={order.remarks}>
                              {order.remarks}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const daysAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))
                            const dotColor = daysAgo <= 7 ? '#4AA078' : daysAgo <= 14 ? '#E8A838' : '#D35741'
                            const label = daysAgo === 0 ? 'today' : `${daysAgo}d ago`
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                <span className="text-sm text-gray-500">{label}</span>
                              </div>
                            )
                          })()}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Order</h2>
              <p className="text-sm text-gray-500">
                {editingOrder.brand} {editingOrder.model} - Ref: {editingOrder.reference}
              </p>
            </div>

            <form onSubmit={handleSubmitOrderEdit} className="p-6 space-y-4">
              {/* Order Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="edit_order_type"
                      value="sell"
                      checked={orderFormData.order_type === 'sell'}
                      onChange={() => setOrderFormData({ ...orderFormData, order_type: 'sell' })}
                      className="h-4 w-4 text-red-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">WTS</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="edit_order_type"
                      value="buy"
                      checked={orderFormData.order_type === 'buy'}
                      onChange={() => setOrderFormData({ ...orderFormData, order_type: 'buy' })}
                      className="h-4 w-4 text-green-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">WTB</span>
                  </label>
                </div>
              </div>

              {/* Watch Catalog Fields — Collapsible */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setWatchDetailsOpen(!watchDetailsOpen)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Watch Details</h3>
                  {watchDetailsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {watchDetailsOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                        <input
                          type="text"
                          required
                          value={orderFormData.brand}
                          onChange={(e) => setOrderFormData({ ...orderFormData, brand: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Rolex"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                        <input
                          type="text"
                          required
                          value={orderFormData.model}
                          onChange={(e) => setOrderFormData({ ...orderFormData, model: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Submariner Date"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                        <input
                          type="text"
                          value={orderFormData.collection}
                          onChange={(e) => setOrderFormData({ ...orderFormData, collection: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Professional"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference *</label>
                        <input
                          type="text"
                          required
                          value={orderFormData.reference}
                          onChange={(e) => setOrderFormData({ ...orderFormData, reference: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., 126610LN"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">OEM-References</label>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {orderFormData.oem_references.map((ref, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                              {ref}
                              <button type="button" onClick={() => setOrderFormData({ ...orderFormData, oem_references: orderFormData.oem_references.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-600">&times;</button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Type + Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const val = (e.target as HTMLInputElement).value.trim()
                              if (val) {
                                setOrderFormData({ ...orderFormData, oem_references: [...orderFormData.oem_references, val] });
                                (e.target as HTMLInputElement).value = ''
                              }
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WS-Code</label>
                        <input
                          type="text"
                          value={orderFormData.ws_code}
                          onChange={(e) => setOrderFormData({ ...orderFormData, ws_code: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Internal code"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dial</label>
                        <input
                          type="text"
                          value={orderFormData.dial}
                          onChange={(e) => setOrderFormData({ ...orderFormData, dial: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bracelet</label>
                        <input
                          type="text"
                          value={orderFormData.bracelet}
                          onChange={(e) => setOrderFormData({ ...orderFormData, bracelet: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Oyster"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aliases</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {orderFormData.aliases.map((alias, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {alias}
                            <button type="button" onClick={() => setOrderFormData({ ...orderFormData, aliases: orderFormData.aliases.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-600">&times;</button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Type + Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const val = (e.target as HTMLInputElement).value.trim()
                            if (val) {
                              setOrderFormData({ ...orderFormData, aliases: [...orderFormData.aliases, val] });
                              (e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={orderFormData.description}
                        onChange={(e) => setOrderFormData({ ...orderFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Watch description..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order Details */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Order Details</h3>

                <div className="grid grid-cols-3 gap-4">
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
                      placeholder="e.g., 12500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                    <select
                      required
                      value={orderFormData.currency}
                      onChange={(e) => setOrderFormData({ ...orderFormData, currency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="text"
                      value={orderFormData.date}
                      onChange={(e) => setOrderFormData({ ...orderFormData, date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="MM/YY or YYYY"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={orderFormData.country_code}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase()
                        const country = COUNTRIES.find(c => c.code === code)
                        setOrderFormData({
                          ...orderFormData,
                          country_code: code,
                          country_name: country?.name || code,
                        })
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="e.g., US, DE, CH"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
                    <input
                      type="text"
                      value={orderFormData.user_name}
                      onChange={(e) => setOrderFormData({ ...orderFormData, user_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Leave empty for admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact (WhatsApp Phone)</label>
                    <input
                      type="text"
                      value={orderFormData.whatsapp_phone}
                      onChange={(e) => setOrderFormData({ ...orderFormData, whatsapp_phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="e.g., +41791234567"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={orderFormData.status}
                    onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={orderFormData.notes}
                    onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Optional notes..."
                  />
                </div>
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
              {/* Order Type */}
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
                    <span className="ml-2 text-sm text-gray-700">WTS</span>
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
                    <span className="ml-2 text-sm text-gray-700">WTB</span>
                  </label>
                </div>
              </div>

              {/* Watch Catalog Fields — Collapsible */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setWatchDetailsOpen(!watchDetailsOpen)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Watch Details</h3>
                  {watchDetailsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {watchDetailsOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                        <input
                          type="text"
                          required
                          value={newOrderFormData.brand}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, brand: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Rolex"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                        <input
                          type="text"
                          required
                          value={newOrderFormData.model}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, model: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Submariner Date"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                        <input
                          type="text"
                          value={newOrderFormData.collection}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, collection: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Professional"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference *</label>
                        <input
                          type="text"
                          required
                          value={newOrderFormData.reference}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, reference: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., 126610LN"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">OEM-References</label>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {newOrderFormData.oem_references.map((ref, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                              {ref}
                              <button type="button" onClick={() => setNewOrderFormData({ ...newOrderFormData, oem_references: newOrderFormData.oem_references.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-600">&times;</button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Type + Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const val = (e.target as HTMLInputElement).value.trim()
                              if (val) {
                                setNewOrderFormData({ ...newOrderFormData, oem_references: [...newOrderFormData.oem_references, val] });
                                (e.target as HTMLInputElement).value = ''
                              }
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WS-Code</label>
                        <input
                          type="text"
                          value={newOrderFormData.ws_code}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, ws_code: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Internal code"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dial</label>
                        <input
                          type="text"
                          value={newOrderFormData.dial}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, dial: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Black"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bracelet</label>
                        <input
                          type="text"
                          value={newOrderFormData.bracelet}
                          onChange={(e) => setNewOrderFormData({ ...newOrderFormData, bracelet: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="e.g., Oyster"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aliases</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {newOrderFormData.aliases.map((alias, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {alias}
                            <button type="button" onClick={() => setNewOrderFormData({ ...newOrderFormData, aliases: newOrderFormData.aliases.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-gray-600">&times;</button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Type + Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const val = (e.target as HTMLInputElement).value.trim()
                            if (val) {
                              setNewOrderFormData({ ...newOrderFormData, aliases: [...newOrderFormData.aliases, val] });
                              (e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={newOrderFormData.description}
                        onChange={(e) => setNewOrderFormData({ ...newOrderFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Watch description..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order Details */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Order Details</h3>

                <div className="grid grid-cols-3 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                    <select
                      required
                      value={newOrderFormData.currency}
                      onChange={(e) => setNewOrderFormData({ ...newOrderFormData, currency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="text"
                      value={newOrderFormData.date}
                      onChange={(e) => setNewOrderFormData({ ...newOrderFormData, date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="MM/YY or YYYY"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={newOrderFormData.country_code}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase()
                        const country = COUNTRIES.find(c => c.code === code)
                        setNewOrderFormData({
                          ...newOrderFormData,
                          country_code: code,
                          country_name: country?.name || code,
                        })
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="e.g., US, DE, CH"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
                    <input
                      type="text"
                      value={newOrderFormData.user_name}
                      onChange={(e) => setNewOrderFormData({ ...newOrderFormData, user_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Leave empty for admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact (WhatsApp Phone)</label>
                    <input
                      type="text"
                      value={newOrderFormData.whatsapp_phone}
                      onChange={(e) => setNewOrderFormData({ ...newOrderFormData, whatsapp_phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="e.g., +41791234567"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={newOrderFormData.notes}
                    onChange={(e) => setNewOrderFormData({ ...newOrderFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Optional notes..."
                  />
                </div>
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
