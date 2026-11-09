import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { api } from '@/services/api'
import { ChangeBatch, apiErrorMessage, describeUndo, undoBatch } from './catalogApi'

interface RecentChangesModalProps {
  open: boolean
  onClose: () => void
  onUndone: () => void
}

/** The last imports and bulk actions, each with its own Undo. */
export function RecentChangesModal({ open, onClose, onUndone }: RecentChangesModalProps) {
  const [batches, setBatches] = useState<ChangeBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/catalog-admin/batches', { params: { limit: 30 } })
      setBatches(res.data)
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Could not load recent changes'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setNotice(null)
      load()
    }
  }, [open])

  if (!open) return null

  const handleUndo = async (batch: ChangeBatch) => {
    if (!confirm(`Undo “${batch.summary}”?`)) return
    setBusyId(batch.id)
    try {
      const result = await undoBatch(batch.id)
      setNotice(`${batch.summary}: ${describeUndo(result).toLowerCase()}`)
      onUndone()
      load()
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Undo failed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Recent changes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        {notice && <div className="mx-4 mt-3 p-2 bg-gray-50 border rounded text-sm text-gray-700">{notice}</div>}
        <div className="overflow-y-auto p-4">
          {loading && batches.length === 0 ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : batches.length === 0 ? (
            <p className="text-sm text-gray-500">No imports or bulk actions yet.</p>
          ) : (
            <ul className="divide-y">
              {batches.map((b) => (
                <li key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm ${b.undone_at ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{b.summary}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(b.created_at + (b.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                      {b.created_by_name ? ` · ${b.created_by_name}` : ''}
                      {b.undone_at ? ' · undone' : ''}
                    </p>
                  </div>
                  {!b.undone_at && (
                    <button
                      onClick={() => handleUndo(b)}
                      disabled={busyId !== null}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      {busyId === b.id ? 'Undoing...' : 'Undo'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
