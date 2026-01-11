import { useEffect, useState } from 'react'
import { Search, AlertTriangle, Bug, RefreshCw, ChevronDown } from 'lucide-react'
import { api } from '@/services/api'

interface Dispute {
  id: string
  user_id: string
  user_name: string
  user_email: string
  watch_reference: string
  watch_brand?: string
  watch_model?: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  admin_notes?: string
  created_at: string
  updated_at?: string
}

interface Issue {
  id: string
  user_id: string
  user_name: string
  user_email: string
  title: string
  description: string
  status: 'open' | 'completed'
  admin_notes?: string
  created_at: string
  updated_at?: string
}

type Tab = 'disputes' | 'issues'

const STATUS_COLORS = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
}

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
  completed: 'Completed',
}

export function AdminSupport() {
  const [activeTab, setActiveTab] = useState<Tab>('disputes')
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [activeTab, statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'disputes') {
        const params = statusFilter ? `?status=${statusFilter}` : ''
        const response = await api.get(`/support/admin/disputes${params}`)
        setDisputes(response.data)
      } else {
        const params = statusFilter ? `?status=${statusFilter}` : ''
        const response = await api.get(`/support/admin/issues${params}`)
        setIssues(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  const handleEdit = (item: Dispute | Issue) => {
    setEditingId(item.id)
    setEditStatus(item.status)
    setEditNotes(item.admin_notes || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditStatus('')
    setEditNotes('')
  }

  const handleSave = async () => {
    if (!editingId) return

    setSaving(true)
    try {
      const endpoint = activeTab === 'disputes'
        ? `/support/admin/disputes/${editingId}`
        : `/support/admin/issues/${editingId}`

      await api.patch(endpoint, {
        status: editStatus,
        admin_notes: editNotes || null,
      })

      setEditingId(null)
      setEditStatus('')
      setEditNotes('')
      fetchData()
    } catch (error) {
      console.error('Failed to update:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredDisputes = disputes.filter((d) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      d.user_name.toLowerCase().includes(searchLower) ||
      d.user_email.toLowerCase().includes(searchLower) ||
      d.watch_reference.toLowerCase().includes(searchLower) ||
      d.description.toLowerCase().includes(searchLower) ||
      (d.watch_brand && d.watch_brand.toLowerCase().includes(searchLower))
    )
  })

  const filteredIssues = issues.filter((i) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      i.user_name.toLowerCase().includes(searchLower) ||
      i.user_email.toLowerCase().includes(searchLower) ||
      i.title.toLowerCase().includes(searchLower) ||
      i.description.toLowerCase().includes(searchLower)
    )
  })

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
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-600">Manage user disputes and reported issues</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => { setActiveTab('disputes'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'disputes'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Disputes
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100">
            {disputes.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('issues'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'issues'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bug className="w-4 h-4" />
          Reported Issues
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100">
            {issues.length}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={activeTab === 'disputes' ? 'Search disputes...' : 'Search issues...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Status</option>
              {activeTab === 'disputes' ? (
                <>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </>
              ) : (
                <>
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-gray-100">
          {activeTab === 'disputes' && filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="p-4">
              {editingId === dispute.id ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {dispute.watch_brand} {dispute.watch_model}
                      </h3>
                      <p className="text-sm text-gray-500">Ref: {dispute.watch_reference}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">{dispute.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes..."
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {dispute.watch_brand} {dispute.watch_model}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[dispute.status]}`}>
                        {STATUS_LABELS[dispute.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">Ref: {dispute.watch_reference}</p>
                    <p className="text-sm text-gray-700 mb-2">{dispute.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>By: {dispute.user_name} ({dispute.user_email})</span>
                      <span>{formatDate(dispute.created_at)}</span>
                    </div>
                    {dispute.admin_notes && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        <strong>Notes:</strong> {dispute.admin_notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleEdit(dispute)}
                    className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          {activeTab === 'issues' && filteredIssues.map((issue) => (
            <div key={issue.id} className="p-4">
              {editingId === issue.id ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">{issue.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="open">Open</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes..."
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[issue.status]}`}>
                        {STATUS_LABELS[issue.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>By: {issue.user_name} ({issue.user_email})</span>
                      <span>{formatDate(issue.created_at)}</span>
                    </div>
                    {issue.admin_notes && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        <strong>Notes:</strong> {issue.admin_notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleEdit(issue)}
                    className="px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          {activeTab === 'disputes' && filteredDisputes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No disputes found</p>
            </div>
          )}

          {activeTab === 'issues' && filteredIssues.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Bug className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No issues found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
