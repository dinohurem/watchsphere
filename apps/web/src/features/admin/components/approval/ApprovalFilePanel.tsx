import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Download, RotateCcw, Upload } from 'lucide-react'
import { api } from '@/services/api'

interface Preview {
  batch_id: string
  expires_at: string
  rows: number
  untouched: number
  apply: Record<string, Record<string, number>>
  apply_total: number
  skipped: Record<string, number>
  warnings: string[]
  sample_apply: { line: number; tab: string; id: string; decision: string; new_value: string }[]
  sample_skipped: { line: number; tab: string; id: string; status: string; detail: string }[]
}

interface Batch {
  batch_id: string
  file_name: string
  status: string
  created_at: string
  created_by_name: string | null
  committed_at: string | null
  undone_at: string | null
  apply_total: number | null
  skipped: Record<string, number> | null
  result: {
    done?: Record<string, number>
    failed?: number
    restored?: number
    removed?: number
    left_alone?: number
    error?: string
  }
}

const TAB_LABEL: Record<string, string> = {
  ai: 'AI decisions',
  unsure: 'Unsure',
  aliases: 'Alias suggestions',
  new_watches: 'New watches',
  prices: 'Suspicious prices',
}

const SKIP_LABEL: Record<string, string> = {
  not_found: 'Case no longer exists or was already decided',
  changed: 'Case changed since the file was downloaded',
  invalid: 'Invalid row',
  duplicate: 'Duplicate row',
}

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-US')
const when = (s: string | null) => (s ? new Date(s.endsWith('Z') ? s : `${s}Z`).toLocaleString() : '')

function errorText(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'errors' in detail) {
    return ((detail as { errors: string[] }).errors || []).join('\n')
  }
  return 'Request failed'
}

async function downloadSkipped(batchId: string) {
  const res = await api.get(`/approval/file/${batchId}/skipped.csv`, {
    responseType: 'blob',
    timeout: 0,
  })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `approval_${batchId}_skipped.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Decisions by file: upload the filled CSV, check the preview, confirm, undo later. */
export function ApprovalFilePanel({ onChanged, reloadKey = 0 }: { onChanged: () => void; reloadKey?: number }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<'' | 'preview' | 'commit' | 'undo'>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [batches, setBatches] = useState<Batch[]>([])

  const loadHistory = useCallback(async () => {
    try {
      setBatches((await api.get('/approval/file')).data)
    } catch (err) {
      console.error('Failed to load approval file history:', err)
    }
  }, [])

  useEffect(() => {
    if (open) loadHistory()
  }, [open, loadHistory, reloadKey])

  const runPreview = async () => {
    if (!file) return
    setBusy('preview')
    setError('')
    setNotice('')
    setPreview(null)
    setConfirmText('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/approval/file/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
      })
      setPreview(res.data)
      loadHistory()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  const confirmNumber = Number(confirmText.replace(/[^\d]/g, ''))
  const canCommit = !!preview && preview.apply_total > 0 && confirmNumber === preview.apply_total

  const runCommit = async () => {
    if (!preview || !canCommit) return
    setBusy('commit')
    setError('')
    try {
      const res = await api.post(
        `/approval/file/${preview.batch_id}/commit`,
        { confirm_apply_total: preview.apply_total },
        { timeout: 600000 }
      )
      const done = Object.values((res.data.done || {}) as Record<string, number>).reduce((a, b) => a + b, 0)
      setNotice(`Done: ${fmt(done)} decisions applied${res.data.failed ? `, ${fmt(res.data.failed)} could not be applied` : ''}.`)
      setPreview(null)
      setFile(null)
      setConfirmText('')
      loadHistory()
      onChanged()
    } catch (err) {
      setError(errorText(err))
      loadHistory()
    } finally {
      setBusy('')
    }
  }

  const runUndo = async (b: Batch) => {
    if (!confirm(`Undo "${b.file_name}"? Everything it decided is put back as it was.`)) return
    setBusy('undo')
    setError('')
    try {
      const res = await api.post(`/approval/file/${b.batch_id}/undo`, undefined, {
        timeout: 600000,
      })
      setNotice(
        `Undone: ${fmt(res.data.restored)} restored, ${fmt(res.data.removed)} created items removed` +
          (res.data.left_alone ? `, ${fmt(res.data.left_alone)} left alone (changed since)` : '') +
          '.'
      )
      loadHistory()
      onChanged()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-900"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Decisions by file
        <span className="text-xs font-normal text-gray-500">
          Download CSV on a tab, fill in <code>decision</code> / <code>new_value</code>, upload it here
        </span>
      </button>
      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              AI decisions / Unsure: <code>confirm</code>, <code>correct</code> (new_value = WS code), <code>not_in_catalogue</code>,{' '}
              <code>discard</code>. Aliases: <code>approve</code>, <code>reject</code>, <code>assign</code> (WS code). New watches:{' '}
              <code>import</code> (WS code), <code>dismiss</code>. Prices: <code>approve</code>, <code>reject</code>,{' '}
              <code>fix_currency</code> (ISO code), <code>correct_price</code> (number); for both <code>suggested</code> takes the flag's
              suggestion. Rows without a decision stay untouched. Nothing changes until you confirm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
                setError('')
              }}
              className="text-sm"
            />
            <button
              disabled={!file || busy !== ''}
              onClick={runPreview}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded disabled:opacity-40"
            >
              <Upload className="w-4 h-4" /> {busy === 'preview' ? 'Checking…' : 'Preview'}
            </button>
          </div>

          {error && <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>}
          {notice && <p className="text-sm text-green-700">{notice}</p>}

          {preview && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="text-sm text-gray-900">
                <span className="font-semibold">{fmt(preview.apply_total)}</span> decisions will be applied
                <span className="text-gray-500">
                  {' '}
                  ({fmt(preview.rows)} rows, {fmt(preview.untouched)} without a decision)
                </span>
              </div>
              {Object.entries(preview.apply).map(([tab, decisions]) => (
                <div key={tab} className="text-sm text-gray-700">
                  <span className="font-medium">{TAB_LABEL[tab] || tab}:</span>{' '}
                  {Object.entries(decisions)
                    .map(([d, n]) => `${fmt(n)} ${d}`)
                    .join(', ')}
                </div>
              ))}
              {Object.keys(preview.skipped).length > 0 && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Skipped:</span>{' '}
                  {Object.entries(preview.skipped)
                    .map(([k, n]) => `${fmt(n)} ${SKIP_LABEL[k] || k}`)
                    .join('; ')}
                  <button
                    onClick={() => downloadSkipped(preview.batch_id)}
                    className="ml-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Download className="w-3 h-3" /> skipped rows
                  </button>
                </div>
              )}
              {preview.warnings.map((w) => (
                <p key={w} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4" /> {w}
                </p>
              ))}
              {preview.sample_skipped.length > 0 && (
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {preview.sample_skipped.map((s) => (
                    <li key={s.line}>
                      line {s.line} · {s.tab} · {s.id}: {s.detail}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <label className="text-sm text-gray-700">
                  Type {fmt(preview.apply_total)} to confirm
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="ml-2 w-28 px-2 py-1 border rounded text-sm"
                    inputMode="numeric"
                  />
                </label>
                <button
                  disabled={!canCommit || busy !== ''}
                  onClick={runCommit}
                  className="px-4 py-1.5 bg-primary text-white text-sm rounded disabled:opacity-40"
                >
                  {busy === 'commit' ? 'Applying…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {batches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Earlier files</h3>
              <div className="divide-y border rounded-lg">
                {batches.map((b) => (
                  <div key={b.batch_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <div className="text-gray-900">{b.file_name}</div>
                      <div className="text-xs text-gray-500">
                        {when(b.created_at)} · {b.created_by_name || ''} · {b.status}
                        {b.status === 'committed' &&
                          ` · ${fmt(Object.values(b.result.done || {}).reduce((a, c) => a + c, 0))} applied` +
                            (b.result.failed ? `, ${fmt(b.result.failed)} failed` : '')}
                        {b.status === 'undone' && ` · ${fmt(b.result.restored)} restored`}
                      </div>
                    </div>
                    {b.status === 'committed' && (
                      <button
                        disabled={busy !== ''}
                        onClick={() => runUndo(b)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40"
                      >
                        <RotateCcw className="w-3 h-3" /> Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
