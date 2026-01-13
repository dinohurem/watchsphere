import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, X, Database } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

interface FilterValue {
  value: string
  label: string
  is_enabled: boolean
  display_order: number
}

interface Filter {
  id: string
  key: string
  name: string
  description?: string | null
  category: 'market' | 'social' | 'order_book'
  filter_type: 'multi_select' | 'single_select' | 'range' | 'text' | 'boolean'
  is_enabled: boolean
  is_searchable: boolean
  display_order: number
  ui_section?: string | null
  range_min?: number | null
  range_max?: number | null
  range_step?: number | null
  placeholder?: string | null
  values: FilterValue[]
  created_at: string
  updated_at?: string | null
}

interface FilterFormData {
  key: string
  name: string
  description: string
  category: string
  filter_type: string
  is_enabled: boolean
  is_searchable: boolean
  display_order: number
  ui_section: string
  range_min: number | null
  range_max: number | null
  range_step: number | null
  placeholder: string
  values: FilterValue[]
}

const emptyForm: FilterFormData = {
  key: '',
  name: '',
  description: '',
  category: 'market',
  filter_type: 'multi_select',
  is_enabled: true,
  is_searchable: false,
  display_order: 0,
  ui_section: '',
  range_min: null,
  range_max: null,
  range_step: null,
  placeholder: '',
  values: [],
}

const FILTER_TYPES = [
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'range', label: 'Range' },
  { value: 'text', label: 'Text' },
  { value: 'boolean', label: 'Boolean' },
]

const CATEGORIES = [
  { value: 'market', label: 'Market' },
  { value: 'social', label: 'Social Search' },
  { value: 'order_book', label: 'Order Book' },
]

const UI_SECTIONS = [
  { value: '', label: 'None' },
  { value: 'watch', label: 'Watch (Basic)' },
  { value: 'price', label: 'Price (Basic)' },
  { value: 'condition', label: 'Condition & Delivery Contents' },
  { value: 'case_size', label: 'Case Size' },
  { value: 'watch_type', label: 'Watch Type' },
  { value: 'caliber', label: 'Movement & Functions' },
  { value: 'dial', label: 'Dial' },
  { value: 'case', label: 'Case' },
  { value: 'band', label: 'Strap / Bracelet' },
  { value: 'clasp', label: 'Clasp' },
]

function FilterTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    multi_select: 'bg-blue-100 text-blue-800',
    single_select: 'bg-purple-100 text-purple-800',
    range: 'bg-green-100 text-green-800',
    text: 'bg-amber-100 text-amber-800',
    boolean: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function SectionBadge({ section }: { section?: string | null }) {
  if (!section) return <span className="text-gray-400 text-xs">—</span>
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
      {section}
    </span>
  )
}

export function AdminFilters() {
  const [filters, setFilters] = useState<Filter[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'market' | 'social' | 'order_book'>('market')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingFilter, setEditingFilter] = useState<Filter | null>(null)
  const [formData, setFormData] = useState<FilterFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Value form state
  const [newValueForm, setNewValueForm] = useState({ value: '', label: '' })

  useEffect(() => {
    fetchFilters()
  }, [])

  const fetchFilters = async () => {
    try {
      const response = await api.get('/filters/admin')
      setFilters(response.data)
    } catch (error) {
      console.error('Failed to fetch filters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingFilter(null)
    setFormData({ ...emptyForm, category: activeTab })
    setShowModal(true)
  }

  const handleEdit = (filter: Filter) => {
    setEditingFilter(filter)
    setFormData({
      key: filter.key,
      name: filter.name,
      description: filter.description || '',
      category: filter.category,
      filter_type: filter.filter_type,
      is_enabled: filter.is_enabled,
      is_searchable: filter.is_searchable,
      display_order: filter.display_order,
      ui_section: filter.ui_section || '',
      range_min: filter.range_min ?? null,
      range_max: filter.range_max ?? null,
      range_step: filter.range_step ?? null,
      placeholder: filter.placeholder || '',
      values: filter.values,
    })
    setShowModal(true)
    setActionMenuOpen(null)
  }

  const handleDelete = async (filterId: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) return
    try {
      await api.delete(`/filters/admin/${filterId}`)
      fetchFilters()
    } catch (error) {
      console.error('Failed to delete filter:', error)
    }
    setActionMenuOpen(null)
  }

  const handleToggleEnabled = async (filter: Filter) => {
    try {
      await api.post(`/filters/admin/${filter.id}/toggle-enabled`)
      fetchFilters()
    } catch (error) {
      console.error('Failed to toggle filter:', error)
    }
    setActionMenuOpen(null)
  }

  const handleSeedData = async () => {
    if (!confirm('This will seed the database with initial filters. Continue?')) return
    setSeeding(true)
    try {
      alert('Run the seed script on the backend:\npython scripts/seed_listing_fields_filters.py')
    } catch (error) {
      console.error('Failed to seed data:', error)
    } finally {
      setSeeding(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        key: formData.key,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        filter_type: formData.filter_type,
        is_enabled: formData.is_enabled,
        is_searchable: formData.is_searchable,
        display_order: formData.display_order,
        ui_section: formData.ui_section || undefined,
        range_min: formData.range_min,
        range_max: formData.range_max,
        range_step: formData.range_step,
        placeholder: formData.placeholder || undefined,
        values: formData.values,
      }

      if (editingFilter) {
        await api.patch(`/filters/admin/${editingFilter.id}`, payload)
      } else {
        await api.post('/filters/admin', payload)
      }

      setShowModal(false)
      fetchFilters()
    } catch (error: any) {
      console.error('Failed to save filter:', error)
      alert(error.response?.data?.detail || 'Failed to save filter')
    } finally {
      setSaving(false)
    }
  }

  const handleAddValue = () => {
    if (!newValueForm.value.trim() || !newValueForm.label.trim()) return
    setFormData({
      ...formData,
      values: [
        ...formData.values,
        {
          value: newValueForm.value.trim(),
          label: newValueForm.label.trim(),
          is_enabled: true,
          display_order: formData.values.length + 1,
        },
      ],
    })
    setNewValueForm({ value: '', label: '' })
  }

  const handleRemoveValue = (index: number) => {
    setFormData({
      ...formData,
      values: formData.values.filter((_, i) => i !== index),
    })
  }

  const handleToggleValueEnabled = (index: number) => {
    const newValues = [...formData.values]
    newValues[index].is_enabled = !newValues[index].is_enabled
    setFormData({ ...formData, values: newValues })
  }

  const filteredFilters = filters.filter(f => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.key.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = f.category === activeTab
    return matchesSearch && matchesCategory
  })

  const tabCounts = {
    market: filters.filter(f => f.category === 'market').length,
    social: filters.filter(f => f.category === 'social').length,
    order_book: filters.filter(f => f.category === 'order_book').length,
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
          <h1 className="text-2xl font-bold text-gray-900">Filters</h1>
          <p className="text-gray-600">Manage market and social search filters ({filters.length} total)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Database className="w-4 h-4 mr-2" />
            {seeding ? 'Seeding...' : 'Seed Data'}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('market')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'market'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Market Filters ({tabCounts.market})
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'social'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Social Search ({tabCounts.social})
          </button>
          <button
            onClick={() => setActiveTab('order_book')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'order_book'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Book ({tabCounts.order_book})
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search filters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                {activeTab === 'market' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Values</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFilters.map((filter) => (
                <>
                  <tr key={filter.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => setExpandedRow(expandedRow === filter.id ? null : filter.id)}
                          className="mr-2 p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedRow === filter.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{filter.name}</span>
                            {filter.is_searchable && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Searchable</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{filter.key}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <FilterTypeBadge type={filter.filter_type} />
                    </td>
                    {activeTab === 'market' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <SectionBadge section={filter.ui_section} />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {filter.values.length > 0 ? (
                          <>
                            {filter.values.filter(v => v.is_enabled).length} / {filter.values.length}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {filter.is_enabled ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Enabled
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <ActionMenu
                        isOpen={actionMenuOpen === filter.id}
                        onToggle={() => setActionMenuOpen(actionMenuOpen === filter.id ? null : filter.id)}
                        onClose={() => setActionMenuOpen(null)}
                      >
                        <ActionMenuItem
                          onClick={() => handleEdit(filter)}
                          icon={<Edit2 className="w-4 h-4" />}
                        >
                          Edit
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => handleToggleEnabled(filter)}
                          icon={filter.is_enabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        >
                          {filter.is_enabled ? 'Disable' : 'Enable'}
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => handleDelete(filter.id)}
                          variant="danger"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Delete
                        </ActionMenuItem>
                      </ActionMenu>
                    </td>
                  </tr>
                  {expandedRow === filter.id && filter.values.length > 0 && (
                    <tr key={`${filter.id}-expanded`}>
                      <td colSpan={activeTab === 'market' ? 6 : 5} className="px-6 py-4 bg-gray-50">
                        <div className="pl-8">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Values ({filter.values.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {filter.values.map((v, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-1 text-xs rounded ${
                                  v.is_enabled
                                    ? 'bg-white border text-gray-700'
                                    : 'bg-gray-200 text-gray-500 line-through'
                                }`}
                              >
                                {v.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {filteredFilters.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No filters found matching your criteria
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingFilter ? 'Edit Filter' : 'Add New Filter'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                  <input
                    type="text"
                    required
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., brand"
                    disabled={!!editingFilter}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={!!editingFilter}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter Type *</label>
                  <select
                    value={formData.filter_type}
                    onChange={(e) => setFormData({ ...formData, filter_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {FILTER_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {formData.category === 'market' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UI Section</label>
                  <select
                    value={formData.ui_section}
                    onChange={(e) => setFormData({ ...formData, ui_section: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {UI_SECTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.filter_type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Enter reference number"
                  />
                </div>
              )}

              {formData.filter_type === 'range' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                    <input
                      type="number"
                      value={formData.range_min ?? ''}
                      onChange={(e) => setFormData({ ...formData, range_min: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                    <input
                      type="number"
                      value={formData.range_max ?? ''}
                      onChange={(e) => setFormData({ ...formData, range_max: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Step</label>
                    <input
                      type="number"
                      value={formData.range_step ?? ''}
                      onChange={(e) => setFormData({ ...formData, range_step: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_enabled"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="is_enabled" className="ml-2 text-sm text-gray-700">Enabled</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_searchable"
                    checked={formData.is_searchable}
                    onChange={(e) => setFormData({ ...formData, is_searchable: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="is_searchable" className="ml-2 text-sm text-gray-700">Searchable (show search in filter)</label>
                </div>
              </div>

              {/* Values Management */}
              {(formData.filter_type === 'multi_select' || formData.filter_type === 'single_select') && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Values</h3>

                  {/* Add new value */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Value (e.g., rolex)"
                      value={newValueForm.value}
                      onChange={(e) => setNewValueForm({ ...newValueForm, value: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g., Rolex)"
                      value={newValueForm.label}
                      onChange={(e) => setNewValueForm({ ...newValueForm, label: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddValue}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
                    >
                      Add
                    </button>
                  </div>

                  {/* Values list */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {formData.values.map((v, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-3 py-2 rounded ${
                          v.is_enabled ? 'bg-gray-50' : 'bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleValueEnabled(idx)}
                            className={`text-xs ${v.is_enabled ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            {v.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <span className={`text-sm ${!v.is_enabled && 'line-through text-gray-400'}`}>
                            {v.label}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{v.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveValue(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.values.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">No values added yet</p>
                    )}
                  </div>
                </div>
              )}

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
                  {saving ? 'Saving...' : (editingFilter ? 'Update Filter' : 'Create Filter')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
