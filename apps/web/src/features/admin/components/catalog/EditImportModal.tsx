import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/services/api'
import { UndoTarget, apiErrorMessage } from './catalogApi'

interface RowResult {
  line: number
  id: string | null
  action: 'updated' | 'unchanged' | 'error'
  errors: string[]
  warnings: string[]
  changes: string[]
  ws_code?: string | null
  old_ws_code?: string | null
  brand?: string | null
  model?: string | null
}

interface EditImportResult {
  dry_run: boolean
  total: number
  updated: number
  unchanged: number
  errors: number
  warnings: number
  ws_codes_changed: number
  summary: string
  batch_id: string | null
  results: RowResult[]
}

interface EditImportModalProps {
  open: boolean
  onClose: () => void
  onSaved: (undo: UndoTarget | null) => void
}

const EXAMPLE = `{"id": "66f1…a2", "ws_code": "5811/1G", "aliases": ["5811g"], "list_prices": {"HK": 599000, "DE": 69500}}
{"id": "66f1…b7", "discontinued": true}`

/** Edit existing watches from JSONL or CSV, matched by id. Check first, then Save or Cancel. */
export function EditImportModal({ open, onClose, onSaved }: EditImportModalProps) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<EditImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const reset = () => {
    setPreview(null)
    setError('')
  }

  const close = () => {
    setText('')
    setFileName('')
    reset()
    onClose()
  }

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.post(
        '/catalog-admin/watches/edit-import',
        { text, format: fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'auto', dry_run: dryRun },
        { timeout: 0 }
      )
      const data = res.data as EditImportResult
      if (dryRun) {
        setPreview(data)
      } else {
        onSaved(data.batch_id ? { batchId: data.batch_id, summary: `Saved · ${data.summary}` } : null)
        close()
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Edit import failed'))
    } finally {
      setBusy(false)
    }
  }

  const problemRows = preview?.results.filter((r) => r.errors.length || r.warnings.length) ?? []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Edit import</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Updates existing watches, matched by <code className="text-xs bg-gray-100 px-1 rounded">id</code>.
              Use <strong>JSONL</strong> or <strong>CSV</strong> (the export formats work as-is).
            </p>
            <ul className="list-disc pl-5 text-xs space-y-0.5">
              <li>Field present → overwritten. Field missing (or empty CSV cell) → unchanged. <code>null</code> → cleared.</li>
              <li>Aliases are added, never replaced. The old WS code does not become an alias.</li>
              <li>List prices merge per country (<code>list_prices</code> object or <code>list_price_HK</code> columns).</li>
              <li>Rows with errors (unknown id, WS code used by another watch, …) are skipped and listed.</li>
            </ul>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-primary font-medium">Show an example</summary>
            <pre className="mt-2 p-3 bg-gray-50 border rounded text-xs overflow-x-auto">{EXAMPLE}</pre>
          </details>

          <div>
            <input
              type="file"
              accept=".jsonl,.json,.csv,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                setText(await file.text())
                reset()
              }}
              className="mb-2 block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-white file:text-sm hover:file:bg-gray-50"
            />
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setFileName('')
                reset()
              }}
              rows={8}
              spellCheck={false}
              className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
              placeholder="Paste JSONL or CSV, or choose a file"
            />
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

          {preview && (
            <div className={`p-3 rounded border text-sm ${preview.errors ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <p className="font-medium">{preview.summary}</p>
              <p className="text-gray-700 text-xs mt-0.5">
                {preview.updated} will change · {preview.unchanged} unchanged
                {preview.warnings ? ` · ${preview.warnings} warning${preview.warnings === 1 ? '' : 's'}` : ''}
              </p>
              {problemRows.length > 0 && (
                <ul className="mt-2 max-h-56 overflow-y-auto text-xs space-y-0.5">
                  {problemRows.map((r) => (
                    <li key={r.line} className={r.errors.length ? 'text-red-700' : 'text-amber-800'}>
                      Line {r.line}
                      {r.ws_code ? ` (${r.ws_code})` : r.id ? ` (${r.id})` : ''} —{' '}
                      {r.errors.length ? `skipped: ${r.errors.join('; ')}` : r.warnings.join('; ')}
                    </li>
                  ))}
                </ul>
              )}
              {preview.ws_codes_changed > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-gray-700">WS code changes</summary>
                  <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5 text-gray-700">
                    {preview.results
                      .filter((r) => r.action === 'updated' && r.changes.includes('ws_code'))
                      .map((r) => (
                        <li key={r.line}>
                          Line {r.line}: {r.old_ws_code || '—'} → {r.ws_code || '—'}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={close} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          {!preview ? (
            <button
              onClick={() => run(true)}
              disabled={busy || !text.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Checking...' : 'Check'}
            </button>
          ) : (
            <button
              onClick={() => run(false)}
              disabled={busy || preview.updated === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Saving...' : `Save ${preview.updated} watch${preview.updated === 1 ? '' : 'es'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
