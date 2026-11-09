import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/services/api'
import { UndoTarget, apiErrorMessage } from './catalogApi'

interface MatchedFile {
  file: string
  watch_id: string
  matched_by: string
  ws_code: string | null
  brand: string | null
  model: string | null
  had_image: boolean
}

interface FileIssue {
  file: string
  reason: string
}

interface ImagesResult {
  matched: MatchedFile[]
  unmatched: FileIssue[]
  ignored: FileIssue[]
  batch_id: string | null
}

interface BulkImagesModalProps {
  open: boolean
  onClose: () => void
  onSaved: (undo: UndoTarget | null) => void
}

// Keep each request small (serverless body limits); ZIPs always go on their own.
const CHUNK_BYTES = 4 * 1024 * 1024
const CHUNK_FILES = 10

function chunkFiles(files: File[]): File[][] {
  const chunks: File[][] = []
  let current: File[] = []
  let size = 0
  for (const f of files) {
    const isZip = f.name.toLowerCase().endsWith('.zip')
    if (isZip) {
      chunks.push([f])
      continue
    }
    if (current.length && (size + f.size > CHUNK_BYTES || current.length >= CHUNK_FILES)) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(f)
    size += f.size
  }
  if (current.length) chunks.push(current)
  return chunks
}

/** Upload many images or ZIPs; file name = watch id, WS code or OEM reference. */
export function BulkImagesModal({ open, onClose, onSaved }: BulkImagesModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<ImagesResult | null>(null)
  const [result, setResult] = useState<ImagesResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const close = () => {
    setFiles([])
    setPreview(null)
    setResult(null)
    setError('')
    setProgress('')
    onClose()
  }

  const send = async (dryRun: boolean): Promise<ImagesResult> => {
    // A dry run only needs names, but ZIP contents are only known server-side, so files are sent.
    const merged: ImagesResult = { matched: [], unmatched: [], ignored: [], batch_id: null }
    const chunks = chunkFiles(files)
    for (let i = 0; i < chunks.length; i++) {
      setProgress(chunks.length > 1 ? `${dryRun ? 'Checking' : 'Uploading'} ${i + 1} / ${chunks.length}` : '')
      const form = new FormData()
      chunks[i].forEach((f) => form.append('files', f, f.name))
      form.append('dry_run', String(dryRun))
      if (merged.batch_id) form.append('batch_id', merged.batch_id)
      const res = await api.post('/catalog-admin/watches/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
      })
      const data = res.data as ImagesResult
      // One image per watch across chunks: in a dry run the server can't see earlier chunks.
      const seen = new Set(merged.matched.map((m) => m.watch_id))
      for (const m of data.matched) {
        if (dryRun && seen.has(m.watch_id)) {
          merged.unmatched.push({ file: m.file, reason: 'another file already matched this watch' })
        } else {
          merged.matched.push(m)
          seen.add(m.watch_id)
        }
      }
      merged.unmatched.push(...data.unmatched)
      merged.ignored.push(...data.ignored)
      if (!dryRun && data.batch_id) merged.batch_id = data.batch_id
    }
    setProgress('')
    return merged
  }

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    try {
      const data = await send(dryRun)
      if (dryRun) {
        setPreview(data)
      } else {
        setResult(data)
        setPreview(null)
        onSaved(
          data.batch_id
            ? { batchId: data.batch_id, summary: `${data.matched.length} image${data.matched.length === 1 ? '' : 's'} uploaded` }
            : null
        )
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Upload failed'))
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  const shown = result ?? preview

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Bulk images</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-600 space-y-1">
            <p>Choose many images or a ZIP. Each file name (without extension) must be a watch id, WS code or OEM reference, e.g. <code className="text-xs bg-gray-100 px-1 rounded">126610LN-0001.png</code>.</p>
            <p className="text-xs">Case does not matter, and <code>/</code>, <code>-</code> and <code>_</code> are treated the same (5811/1G → 5811-1G.jpg). One image per watch; an existing image is replaced. <code>__MACOSX/</code> and <code>._*</code> files are ignored.</p>
          </div>

          <input
            type="file"
            multiple
            accept="image/*,.zip"
            onChange={(e) => {
              setFiles(Array.from(e.target.files || []))
              setPreview(null)
              setResult(null)
              setError('')
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-white file:text-sm hover:file:bg-gray-50"
          />
          {files.length > 0 && !shown && (
            <p className="text-xs text-gray-500">
              {files.length} file{files.length === 1 ? '' : 's'} · {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
            </p>
          )}

          {progress && <p className="text-sm text-gray-600">{progress}</p>}
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

          {shown && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">
                {result ? 'Uploaded' : 'Will upload'} {shown.matched.length} image{shown.matched.length === 1 ? '' : 's'}
                {' · '}
                {shown.unmatched.length} not matched
                {shown.ignored.length ? ` · ${shown.ignored.length} ignored` : ''}
              </p>
              {shown.unmatched.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="font-medium text-amber-900 mb-1">Not matched</p>
                  <ul className="max-h-40 overflow-y-auto text-xs space-y-0.5 text-amber-900">
                    {shown.unmatched.map((u, i) => (
                      <li key={`${u.file}-${i}`}>
                        {u.file} — {u.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {shown.matched.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-gray-700">Matched files</summary>
                  <ul className="mt-1 max-h-48 overflow-y-auto text-xs space-y-0.5 text-gray-700">
                    {shown.matched.map((m) => (
                      <li key={m.watch_id}>
                        {m.file} → {m.ws_code || `${m.brand} ${m.model}`} <span className="text-gray-400">({m.matched_by.replace('_', ' ')}{m.had_image ? ', replaces image' : ''})</span>
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
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <>
              <button
                onClick={() => run(true)}
                disabled={busy || files.length === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {busy && !preview ? 'Checking...' : 'Check'}
              </button>
              <button
                onClick={() => run(false)}
                disabled={busy || files.length === 0 || (preview !== null && preview.matched.length === 0)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {busy && preview ? 'Uploading...' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
