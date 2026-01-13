import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, X, Database } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

interface ListingFieldValue {
  value: string
  label: string
  is_enabled: boolean
  display_order: number
  parent_value?: string | null
}

interface ListingField {
  id: string
  key: string
  name: string
  description?: string | null
  field_type: 'dropdown' | 'text' | 'number' | 'multi_select' | 'textarea'
  is_enabled: boolean
  is_required: boolean
  display_order: number
  category: string
  parent_field_key?: string | null
  placeholder?: string | null
  min_value?: number | null
  max_value?: number | null
  values: ListingFieldValue[]
  created_at: string
  updated_at?: string | null
}

interface FieldFormData {
  key: string
  name: string
  description: string
  field_type: string
  is_enabled: boolean
  is_required: boolean
  display_order: number
  category: string
  parent_field_key: string
  placeholder: string
  min_value: number | null
  max_value: number | null
  values: ListingFieldValue[]
}

const emptyForm: FieldFormData = {
  key: '',
  name: '',
  description: '',
  field_type: 'dropdown',
  is_enabled: true,
  is_required: false,
  display_order: 0,
  category: 'basic',
  parent_field_key: '',
  placeholder: '',
  min_value: null,
  max_value: null,
  values: [],
}

const FIELD_TYPES = [
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'textarea', label: 'Textarea' },
]

const CATEGORIES = [
  { value: 'basic', label: 'Basic', step: 1, stepTitle: 'Basic Information' },
  { value: 'caliber', label: 'Caliber', step: 2, stepTitle: 'Caliber Information' },
  { value: 'case', label: 'Case', step: 3, stepTitle: 'Case Information' },
  { value: 'bracelet', label: 'Bracelet', step: 4, stepTitle: 'Bracelet/Strap Information' },
]

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    basic: 'bg-blue-100 text-blue-800',
    caliber: 'bg-purple-100 text-purple-800',
    case: 'bg-green-100 text-green-800',
    bracelet: 'bg-amber-100 text-amber-800',
  }
  const categoryInfo = CATEGORIES.find(c => c.value === category)
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
        {category}
      </span>
      {categoryInfo && (
        <span className="text-xs text-gray-400 px-2">Step {categoryInfo.step}</span>
      )}
    </div>
  )
}

function FieldTypeBadge({ type }: { type: string }) {
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
      {type.replace('_', ' ')}
    </span>
  )
}

export function AdminListingFields() {
  const [fields, setFields] = useState<ListingField[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingField, setEditingField] = useState<ListingField | null>(null)
  const [formData, setFormData] = useState<FieldFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Value form state
  const [newValueForm, setNewValueForm] = useState({ value: '', label: '', parent_value: '' })
  const [_editingValueIndex, _setEditingValueIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchFields()
  }, [])

  const fetchFields = async () => {
    try {
      const response = await api.get('/listing-fields/admin')
      setFields(response.data)
    } catch (error) {
      console.error('Failed to fetch listing fields:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingField(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const handleEdit = (field: ListingField) => {
    setEditingField(field)
    setFormData({
      key: field.key,
      name: field.name,
      description: field.description || '',
      field_type: field.field_type,
      is_enabled: field.is_enabled,
      is_required: field.is_required,
      display_order: field.display_order,
      category: field.category,
      parent_field_key: field.parent_field_key || '',
      placeholder: field.placeholder || '',
      min_value: field.min_value ?? null,
      max_value: field.max_value ?? null,
      values: field.values,
    })
    setShowModal(true)
    setActionMenuOpen(null)
  }

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return
    try {
      await api.delete(`/listing-fields/admin/${fieldId}`)
      fetchFields()
    } catch (error) {
      console.error('Failed to delete field:', error)
    }
    setActionMenuOpen(null)
  }

  const handleToggleEnabled = async (field: ListingField) => {
    try {
      await api.post(`/listing-fields/admin/${field.id}/toggle-enabled`)
      fetchFields()
    } catch (error) {
      console.error('Failed to toggle field:', error)
    }
    setActionMenuOpen(null)
  }

  const handleSeedData = async () => {
    if (!confirm('This will seed the database with initial listing fields. Continue?')) return
    setSeeding(true)
    try {
      // We'll need to run the seed script from the backend
      // For now, show instructions
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
        field_type: formData.field_type,
        is_enabled: formData.is_enabled,
        is_required: formData.is_required,
        display_order: formData.display_order,
        category: formData.category,
        parent_field_key: formData.parent_field_key || undefined,
        placeholder: formData.placeholder || undefined,
        min_value: formData.min_value,
        max_value: formData.max_value,
        values: formData.values,
      }

      if (editingField) {
        await api.patch(`/listing-fields/admin/${editingField.id}`, payload)
      } else {
        await api.post('/listing-fields/admin', payload)
      }

      setShowModal(false)
      fetchFields()
    } catch (error: any) {
      console.error('Failed to save field:', error)
      alert(error.response?.data?.detail || 'Failed to save field')
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
          parent_value: newValueForm.parent_value.trim() || null,
        },
      ],
    })
    setNewValueForm({ value: '', label: '', parent_value: '' })
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

  const filteredFields = fields.filter(field => {
    const matchesSearch =
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.key.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || field.category === categoryFilter
    return matchesSearch && matchesCategory
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
          <h1 className="text-2xl font-bold text-gray-900">Listing Fields</h1>
          <p className="text-gray-600">Manage fields for creating watch listings ({fields.length} total)</p>
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
            Add Field
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
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Values</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredFields.map((field) => (
                <>
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => setExpandedRow(expandedRow === field.id ? null : field.id)}
                          className="mr-2 p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedRow === field.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{field.name}</span>
                            {field.is_required && (
                              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">Required</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{field.key}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <FieldTypeBadge type={field.field_type} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CategoryBadge category={field.category} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {field.values.length > 0 ? (
                          <>
                            {field.values.filter(v => v.is_enabled).length} / {field.values.length}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {field.is_enabled ? (
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
                        isOpen={actionMenuOpen === field.id}
                        onToggle={() => setActionMenuOpen(actionMenuOpen === field.id ? null : field.id)}
                        onClose={() => setActionMenuOpen(null)}
                      >
                        <ActionMenuItem
                          onClick={() => handleEdit(field)}
                          icon={<Edit2 className="w-4 h-4" />}
                        >
                          Edit
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => handleToggleEnabled(field)}
                          icon={field.is_enabled ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        >
                          {field.is_enabled ? 'Disable' : 'Enable'}
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => handleDelete(field.id)}
                          variant="danger"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Delete
                        </ActionMenuItem>
                      </ActionMenu>
                    </td>
                  </tr>
                  {expandedRow === field.id && field.values.length > 0 && (
                    <tr key={`${field.id}-expanded`}>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="pl-8">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Values ({field.values.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {field.values.map((v, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-1 text-xs rounded ${
                                  v.is_enabled
                                    ? 'bg-white border text-gray-700'
                                    : 'bg-gray-200 text-gray-500 line-through'
                                }`}
                              >
                                {v.label}
                                {v.parent_value && (
                                  <span className="text-gray-400 ml-1">({v.parent_value})</span>
                                )}
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

        {filteredFields.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No fields found matching your criteria
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingField ? 'Edit Field' : 'Add New Field'}
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
                    disabled={!!editingField}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Type *</label>
                  <select
                    value={formData.field_type}
                    onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label} (Step {cat.step})</option>
                    ))}
                  </select>
                  {(() => {
                    const selectedCat = CATEGORIES.find(c => c.value === formData.category)
                    return selectedCat ? (
                      <p className="mt-1 text-xs text-gray-500">
                        This field will appear in <span className="font-medium">Step {selectedCat.step}: {selectedCat.stepTitle}</span>
                      </p>
                    ) : null
                  })()}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Field Key</label>
                  <select
                    value={formData.parent_field_key}
                    onChange={(e) => setFormData({ ...formData, parent_field_key: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">None</option>
                    {fields.filter(f => f.id !== editingField?.id).map(f => (
                      <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="e.g., Select brand"
                  />
                </div>
              </div>

              {formData.field_type === 'number' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                    <input
                      type="number"
                      value={formData.min_value ?? ''}
                      onChange={(e) => setFormData({ ...formData, min_value: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                    <input
                      type="number"
                      value={formData.max_value ?? ''}
                      onChange={(e) => setFormData({ ...formData, max_value: e.target.value ? parseFloat(e.target.value) : null })}
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
                    id="is_required"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="is_required" className="ml-2 text-sm text-gray-700">Required</label>
                </div>
              </div>

              {/* Values Management */}
              {(formData.field_type === 'dropdown' || formData.field_type === 'multi_select') && (
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
                    {formData.parent_field_key && (
                      <input
                        type="text"
                        placeholder="Parent value"
                        value={newValueForm.parent_value}
                        onChange={(e) => setNewValueForm({ ...newValueForm, parent_value: e.target.value })}
                        className="w-32 px-3 py-2 border rounded-lg text-sm"
                      />
                    )}
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
                          {v.parent_value && (
                            <span className="text-xs text-purple-500">({v.parent_value})</span>
                          )}
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
                  {saving ? 'Saving...' : (editingField ? 'Update Field' : 'Create Field')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
