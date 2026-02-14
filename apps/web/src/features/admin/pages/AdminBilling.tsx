import { useEffect, useState } from 'react'
import { Plus, Search, DollarSign, TrendingUp, Users, Edit2, Crown, Calendar, History, Trash2, X } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

interface BillingRecord {
  id: string
  user_id: string
  user_name: string
  user_email: string
  type: 'subscription' | 'transaction_fee'
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
  description: string | null
  invoice_number: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
}

interface Subscription {
  id: string
  user_id: string
  user_name: string
  user_email: string
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  status: 'active' | 'cancelled' | 'expired' | 'past_due'
  price_monthly: number
  currency: string
  started_at: string
  expires_at: string | null
  auto_renew: boolean
  created_at: string
}

interface SubscriptionHistoryRecord {
  id: string
  subscription_id: string
  user_id: string
  user_name: string
  user_email: string
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  status: 'active' | 'cancelled' | 'expired' | 'past_due'
  price_monthly: number
  currency: string
  action: string
  action_by: string | null
  period_start: string
  period_end: string | null
  created_at: string
}

interface Stats {
  billing: {
    total_records: number
    total_billed: number
    total_paid: number
    total_pending: number
    pending_count: number
  }
  subscriptions: {
    total: number
    active: number
    mrr: number
    by_plan: Record<string, number>
  }
  transactions: {
    total: number
    completed: number
    volume: number
    fees_collected: number
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  past_due: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
}

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  basic: 'bg-blue-100 text-blue-800',
  premium: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-amber-100 text-amber-800',
}

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  renewed: 'bg-blue-100 text-blue-800',
  upgraded: 'bg-purple-100 text-purple-800',
  downgraded: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
}

type TabType = 'billing' | 'subscriptions'

// Format date in EU format (DD/MM/YYYY)
const formatDateEU = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function AdminBilling() {
  const [activeTab, setActiveTab] = useState<TabType>('billing')
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [formData, setFormData] = useState({
    user_id: '',
    type: 'subscription' as 'subscription' | 'transaction_fee',
    amount: 0,
    currency: 'EUR',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [showCreateSubscriptionModal, setShowCreateSubscriptionModal] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historySubscription, setHistorySubscription] = useState<Subscription | null>(null)
  const [historyRecords, setHistoryRecords] = useState<SubscriptionHistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null)
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    user_id: '',
    plan: 'basic' as 'free' | 'basic' | 'premium' | 'enterprise',
    status: 'active' as 'active' | 'cancelled' | 'expired' | 'past_due',
    price_monthly: 0,
    currency: 'EUR',
    expires_at: '',
    auto_renew: false,
  })

  useEffect(() => {
    fetchData()
  }, [])


  const fetchData = async () => {
    setLoading(true)
    try {
      const [billingRes, subsRes, statsRes, usersRes] = await Promise.all([
        api.get('/billing/admin/billing'),
        api.get('/billing/admin/subscriptions'),
        api.get('/billing/admin/billing/stats'),
        api.get('/admin/users'),
      ])
      setBillingRecords(billingRes.data)
      setSubscriptions(subsRes.data)
      setStats(statsRes.data)
      setUsers(usersRes.data)
    } catch (error) {
      console.error('Failed to fetch billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBilling = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/billing/admin/billing', {
        ...formData,
        description: formData.description || undefined,
      })
      setShowCreateModal(false)
      setFormData({ user_id: '', type: 'subscription', amount: 0, currency: 'EUR', description: '' })
      fetchData()
    } catch (error) {
      console.error('Failed to create billing:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateBillingStatus = async (billingId: string, newStatus: string) => {
    try {
      await api.patch(`/billing/admin/billing/${billingId}`, {
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined,
      })
      fetchData()
    } catch (error) {
      console.error('Failed to update billing:', error)
    }
  }

  const openEditSubscriptionModal = (sub: Subscription) => {
    setEditingSubscription(sub)
    setSubscriptionFormData({
      user_id: sub.user_id,
      plan: sub.plan,
      status: sub.status,
      price_monthly: sub.price_monthly,
      currency: sub.currency,
      expires_at: sub.expires_at ? new Date(sub.expires_at).toISOString().split('T')[0] : '',
      auto_renew: sub.auto_renew,
    })
    setShowSubscriptionModal(true)
  }

  const openCreateSubscriptionModal = () => {
    setEditingSubscription(null)
    setSubscriptionFormData({
      user_id: '',
      plan: 'premium',
      status: 'active',
      price_monthly: 100,
      currency: 'EUR',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      auto_renew: true,
    })
    setShowCreateSubscriptionModal(true)
  }

  const openHistoryModal = async (sub: Subscription) => {
    setHistorySubscription(sub)
    setShowHistoryModal(true)
    setLoadingHistory(true)
    setActiveActionMenu(null)
    try {
      const res = await api.get(`/billing/admin/subscriptions/${sub.id}/history`)
      setHistoryRecords(res.data)
    } catch (error) {
      console.error('Failed to fetch subscription history:', error)
      setHistoryRecords([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const openDeleteModal = (sub: Subscription) => {
    setDeletingSubscription(sub)
    setShowDeleteModal(true)
    setActiveActionMenu(null)
  }

  const handleDeleteSubscription = async () => {
    if (!deletingSubscription) return
    setDeleting(true)
    try {
      await api.delete(`/billing/admin/subscriptions/${deletingSubscription.id}`)
      setShowDeleteModal(false)
      setDeletingSubscription(null)
      fetchData()
    } catch (error: any) {
      console.error('Failed to delete subscription:', error)
      alert(error.response?.data?.detail || 'Failed to delete subscription')
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingSubscription) {
        // Update existing subscription
        await api.patch(`/billing/admin/subscriptions/${editingSubscription.id}`, {
          plan: subscriptionFormData.plan,
          status: subscriptionFormData.status,
          price_monthly: subscriptionFormData.price_monthly,
          currency: subscriptionFormData.currency,
          expires_at: subscriptionFormData.expires_at ? new Date(subscriptionFormData.expires_at).toISOString() : null,
          auto_renew: subscriptionFormData.auto_renew,
        })
      } else {
        // Create new subscription
        await api.post('/billing/admin/subscriptions', {
          user_id: subscriptionFormData.user_id,
          plan: subscriptionFormData.plan,
          status: subscriptionFormData.status,
          price_monthly: subscriptionFormData.price_monthly,
          currency: subscriptionFormData.currency,
          expires_at: subscriptionFormData.expires_at ? new Date(subscriptionFormData.expires_at).toISOString() : null,
          auto_renew: subscriptionFormData.auto_renew,
        })
      }
      setShowSubscriptionModal(false)
      setShowCreateSubscriptionModal(false)
      setEditingSubscription(null)
      fetchData()
    } catch (error: any) {
      console.error('Failed to save subscription:', error)
      alert(error.response?.data?.detail || 'Failed to save subscription')
    } finally {
      setSaving(false)
    }
  }

  const filteredBilling = billingRecords.filter(r =>
    r.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredSubscriptions = subscriptions.filter(s =>
    s.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600">Manage subscriptions and transaction fees</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                EUR {stats?.billing.total_paid.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Recurring</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                EUR {stats?.subscriptions.mrr.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.subscriptions.active || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="border-b flex">
          {(['billing', 'subscriptions'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                {tab === 'billing' ? billingRecords.length : subscriptions.length}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          {activeTab === 'billing' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </button>
          )}
          {activeTab === 'subscriptions' && (
            <button
              onClick={openCreateSubscriptionModal}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Grant Subscription
            </button>
          )}
        </div>

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBilling.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{record.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.user_name}</div>
                      <div className="text-sm text-gray-500">{record.user_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 capitalize">{record.type.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {record.currency} {record.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[record.status]}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateEU(record.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {record.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateBillingStatus(record.id, 'paid')}
                          className="text-sm text-green-600 hover:text-green-800 font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBilling.length === 0 && (
              <div className="p-8 text-center text-gray-500">No billing records found</div>
            )}
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auto Renew</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{sub.user_name}</div>
                      <div className="text-sm text-gray-500">{sub.user_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${planColors[sub.plan]}`}>
                        {sub.plan}
                      </span>
                      {sub.price_monthly === 0 && (
                        <span className="ml-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Trial
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {sub.price_monthly === 0 ? 'Free' : `${sub.currency} ${sub.price_monthly}/mo`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[sub.status]}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sub.expires_at ? formatDateEU(sub.expires_at) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${sub.auto_renew ? 'text-green-600' : 'text-gray-400'}`}>
                        {sub.auto_renew ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <ActionMenu
                        isOpen={activeActionMenu === sub.id}
                        onToggle={() => setActiveActionMenu(activeActionMenu === sub.id ? null : sub.id)}
                        onClose={() => setActiveActionMenu(null)}
                      >
                        <ActionMenuItem
                          onClick={() => { openEditSubscriptionModal(sub); setActiveActionMenu(null) }}
                          icon={<Edit2 className="w-4 h-4" />}
                        >
                          Edit
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => { openHistoryModal(sub); setActiveActionMenu(null) }}
                          icon={<History className="w-4 h-4" />}
                        >
                          View History
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => { openDeleteModal(sub); setActiveActionMenu(null) }}
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
            {filteredSubscriptions.length === 0 && (
              <div className="p-8 text-center text-gray-500">No subscriptions found</div>
            )}
          </div>
        )}

      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
            </div>

            <form onSubmit={handleCreateBilling} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User *</label>
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'subscription' | 'transaction_fee' })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="subscription">Subscription</option>
                  <option value="transaction_fee">Transaction Fee</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
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
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., Monthly subscription - December 2024"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {showSubscriptionModal && editingSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Subscription</h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingSubscription.user_name} ({editingSubscription.user_email})
              </p>
            </div>

            <form onSubmit={handleSaveSubscription} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                  <select
                    required
                    value={subscriptionFormData.plan}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, plan: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={subscriptionFormData.status}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (Monthly)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subscriptionFormData.price_monthly}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, price_monthly: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={subscriptionFormData.currency}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Expires At
                </label>
                <input
                  type="date"
                  value={subscriptionFormData.expires_at}
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={subscriptionFormData.auto_renew}
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, auto_renew: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="auto_renew" className="text-sm text-gray-700">Auto-renew subscription</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubscriptionModal(false)
                    setEditingSubscription(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Grant Subscription Modal */}
      {showCreateSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Grant Subscription</h2>
              <p className="text-sm text-gray-500 mt-1">Assign a subscription plan to a user</p>
            </div>

            <form onSubmit={handleSaveSubscription} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User *</label>
                <select
                  required
                  value={subscriptionFormData.user_id}
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                  <select
                    required
                    value={subscriptionFormData.plan}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, plan: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={subscriptionFormData.status}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (Monthly)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={subscriptionFormData.price_monthly}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, price_monthly: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set to 0 for free trial</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={subscriptionFormData.currency}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Expires At *
                </label>
                <input
                  type="date"
                  required
                  value={subscriptionFormData.expires_at}
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create_auto_renew"
                  checked={subscriptionFormData.auto_renew}
                  onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, auto_renew: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="create_auto_renew" className="text-sm text-gray-700">Auto-renew subscription</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateSubscriptionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Grant Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription History Modal */}
      {showHistoryModal && historySubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Subscription History</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {historySubscription.user_name} ({historySubscription.user_email})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setHistorySubscription(null)
                  setHistoryRecords([])
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No history records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyRecords.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${actionColors[record.action] || 'bg-gray-100 text-gray-800'}`}>
                          {record.action}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDateEU(record.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Plan:</span>
                          <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full capitalize ${planColors[record.plan]}`}>
                            {record.plan}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[record.status]}`}>
                            {record.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Price:</span>
                          <span className="ml-2 font-medium">
                            {record.price_monthly === 0 ? 'Free' : `${record.currency} ${record.price_monthly}/mo`}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Period Start:</span>
                          <span className="ml-2">{formatDateEU(record.period_start)}</span>
                        </div>
                        {record.period_end && (
                          <div>
                            <span className="text-gray-500">Period End:</span>
                            <span className="ml-2">{formatDateEU(record.period_end)}</span>
                          </div>
                        )}
                        {record.action_by && (
                          <div>
                            <span className="text-gray-500">Action By:</span>
                            <span className="ml-2">{record.action_by}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Delete Subscription</h2>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {deletingSubscription.user_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {deletingSubscription.user_email}
                  </p>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this subscription? This will also remove all subscription history records.
              </p>

              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                This action cannot be undone.
              </p>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingSubscription(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubscription}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
