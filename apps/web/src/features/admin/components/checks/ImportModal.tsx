import { useState } from 'react'
import { X } from 'lucide-react'
import { apiErrorMessage } from '@/features/admin/components/catalog'
import {
  commitImport,
  type ConflictMode,
  previewImport,
  type DuplicateMode,
  type ImportCommitResult,
  type ImportPreview,
  type ImportRowStatus,
} from './checksApi'
import type { CollectionConfig } from './checksConfig'

interface Props {
  config: CollectionConfig
  onClose: () => void
  onDone: () => void
}

const ROW_STYLES: Record<ImportRowStatus, string> = {
  new: 'bg-green-100 text-green-800',
  duplicate: 'bg-amber-100 text-amber-800',
  conflict: 'bg-orange-100 text-orange-800',
  invalid: 'bg-red-100 text-red-800',
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

/** Upload CSV/XLSX (+ optional photos ZIP), review the preview, then commit. */
export function ImportModal({ config, onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [zip, setZip] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<DuplicateMode>('skip')
  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip')
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportCommitResult | null>(null)

  const runPreview = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      setPreview(await previewImport(config.collection, file, zip))
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not read the file'))
    } finally {
      setBusy(false)
    }
  }

  const runCommit = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      setResult(await commitImport(config.collection, preview.token, {
          duplicates: mode,
          conflicts: conflictMode,
          skipRows: [...skipRows],
        }))
    } catch (err) {
      setError(apiErrorMessage(err, 'Import failed'))
    } finally {
      setBusy(false)
    }
  }

  const counts = (preview?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const importable = (preview?.rows ?? []).filter((r) => {
    if (skipRows.has(r.row)) return false
    if (r.status === 'new') return true
    if (r.status === 'duplicate') return mode === 'update'
    if (r.status === 'conflict') return conflictMode === 'import'
    return false
  }).length
  const columns = preview ? Object.keys(preview.rows[0]?.data ?? {}).filter((k) => !k.endsWith('_normalized')) : []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Bulk import {config.nounPlural}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-900">
                Import finished: {result.created} created, {result.updated} updated, {result.skipped} skipped.
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onDone}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Upload a <strong>CSV</strong> or <strong>XLSX</strong> file with the columns{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{config.importColumns}</code>. Export
                  the list first to get a file in exactly this format.
                </p>
                <p>
                  Photos are optional: add a ZIP and match the files by name in the{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">photo_filename</code> column.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data file *</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    aria-label="Data file"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null)
                      setPreview(null)
                    }}
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photos ZIP (optional)</label>
                  <input
                    type="file"
                    accept=".zip"
                    aria-label="Photos ZIP"
                    onChange={(e) => {
                      setZip(e.target.files?.[0] ?? null)
                      setPreview(null)
                    }}
                    className="w-full text-sm"
                  />
                </div>
              </div>

              {!preview && (
                <button
                  onClick={runPreview}
                  disabled={!file || busy}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? 'Reading...' : 'Preview'}
                </button>
              )}

              {preview && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{preview.rows.length} {preview.rows.length === 1 ? 'row' : 'rows'}:</span>
                    {(['new', 'duplicate', 'conflict', 'invalid'] as ImportRowStatus[]).map((s) => (
                      <span key={s} className={`px-2 py-1 rounded-full text-xs font-medium ${ROW_STYLES[s]}`}>
                        {counts[s] ?? 0} {s}
                      </span>
                    ))}
                  </div>

                  {(counts.duplicate ?? 0) > 0 && (
                    <fieldset className="text-sm flex flex-wrap items-center gap-4">
                      <legend className="sr-only">Duplicates</legend>
                      <span className="font-medium text-gray-700">Duplicates:</span>
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="dup" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                        Skip existing
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="radio" name="dup" checked={mode === 'update'} onChange={() => setMode('update')} />
                        Update existing
                      </label>
                    </fieldset>
                  )}

                  {(counts.conflict ?? 0) > 0 && (
                    <fieldset className="text-sm flex flex-wrap items-center gap-4">
                      <legend className="sr-only">Conflicts</legend>
                      <span className="font-medium text-gray-700">Conflicts (verified and scammer):</span>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="conflict"
                          checked={conflictMode === 'skip'}
                          onChange={() => setConflictMode('skip')}
                        />
                        Skip them
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="conflict"
                          checked={conflictMode === 'import'}
                          onChange={() => setConflictMode('import')}
                        />
                        Import anyway
                      </label>
                    </fieldset>
                  )}

                  <div className="overflow-x-auto border rounded-lg max-h-96">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Skip</th>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Result</th>
                          <th className="px-3 py-2 text-left">Message</th>
                          {columns.map((c) => (
                            <th key={c} className="px-3 py-2 text-left font-medium text-gray-500">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.rows.map((r) => (
                          <tr key={r.row} className={r.status === 'invalid' ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                aria-label={`Skip row ${r.row}`}
                                disabled={r.status === 'invalid'}
                                checked={r.status === 'invalid' || skipRows.has(r.row)}
                                onChange={() =>
                                  setSkipRows((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(r.row)) next.delete(r.row)
                                    else next.add(r.row)
                                    return next
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">{r.row}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${ROW_STYLES[r.status]}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-700 min-w-48">{r.message}</td>
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-2 text-gray-600 max-w-48 truncate">
                                {cell(r.data[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-gray-500">
                    Invalid rows are always skipped. Tick Skip to leave out any other row.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setPreview(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={runCommit}
                      disabled={busy || importable === 0}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {busy ? 'Importing...' : `Import ${importable} ${importable === 1 ? 'row' : 'rows'}`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}
