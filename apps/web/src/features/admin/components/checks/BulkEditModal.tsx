import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { apiErrorMessage } from '@/features/admin/components/catalog'
import { bulkEdit } from './checksApi'
import type { CollectionConfig } from './checksConfig'
import { FieldInput } from './CheckFormModal'

interface Props {
  config: CollectionConfig
  ids: string[]
  onClose: () => void
  onDone: (updated: number) => void
}

interface Change {
  field: string
  value: unknown
}

/** Change status, type or any other field for all selected rows at once. */
export function BulkEditModal({ config, ids, onClose, onDone }: Props) {
  const bulkFields = config.fields.filter((f) => f.bulk)
  const [changes, setChanges] = useState<Change[]>([{ field: 'status', value: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const update = (i: number, patch: Partial<Change>) =>
    setChanges((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  const usable = changes.filter((c) => c.field && c.value !== '' && c.value !== undefined)

  const apply = async () => {
    setBusy(true)
    setError('')
    const set: Record<string, unknown> = {}
    for (const c of usable) set[c.field] = c.value
    try {
      await bulkEdit(config.collection, ids, set)
      onDone(ids.length)
    } catch (err) {
      setError(apiErrorMessage(err, 'Bulk edit failed'))
    } finally {
      setBusy(false)
    }
  }

  const unusedFields = (current: string) =>
    bulkFields.filter((f) => f.key === current || !changes.some((c) => c.field === f.key))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            Bulk edit {ids.length} {ids.length === 1 ? config.noun : config.nounPlural}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Choose the fields to change. Every selected row gets the same new value.
          </p>
          {changes.map((c, i) => {
            const def = bulkFields.find((f) => f.key === c.field)
            return (
              <div key={c.field + i} className="grid grid-cols-[10rem_1fr_auto] gap-2 items-start">
                <select
                  value={c.field}
                  onChange={(e) => update(i, { field: e.target.value, value: '' })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  aria-label="Field to change"
                >
                  {unusedFields(c.field).map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {def ? (
                  <FieldInput field={def} value={c.value} onChange={(v) => update(i, { value: v })} bare />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  aria-label="Remove change"
                  disabled={changes.length === 1}
                  onClick={() => setChanges((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
          {changes.length < bulkFields.length && (
            <button
              type="button"
              onClick={() => {
                const next = bulkFields.find((f) => !changes.some((c) => c.field === f.key))
                if (next) setChanges((prev) => [...prev, { field: next.key, value: '' }])
              }}
              className="flex items-center gap-1 text-sm text-primary"
            >
              <Plus size={14} /> Change another field
            </button>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={busy || usable.length === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Applying...' : `Apply to ${ids.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
