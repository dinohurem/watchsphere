import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download, RotateCcw, Upload } from 'lucide-react'
import { api } from '@/services/api'

type Action = 'delete' | 'move' | 'set_currency' | 'clear_price'

interface Preview {
  batch_id: string
  expires_at: string
  rows: number
  apply: Record<Action, number>
  apply_total: number
  skipped: Record<string, number>
  delete_share_of_active_orders: number
  warnings: string[]
  top_reasons: { action: Action; reason: string; count: number }[]
  sample_apply: {
    line: number
    order_id: string
    action: Action
    ws_code: string | null
    price: number | null
    currency: string | null
    new_value: string
    reason: string
    source_line: string
  }[]
  sample_skipped: { line: number; order_id: string; status: string; detail: string }[]
}

interface Batch {
  batch_id: string
  file_name: string
  status: string
  created_at: string
  created_by_name: string | null
  committed_at: string | null
  undone_at: string | null
  apply: Record<Action, number> | null
  apply_total: number | null
  skipped: Record<string, number> | null
  result: {
    done?: Record<Action, number>
    failed?: number
    restored?: number
    reverted?: number
    error?: string
  }
}

const ACTION_LABEL: Record<Action, string> = {
  delete: 'Delete',
  move: 'Move to other watch',
  set_currency: 'Fix currency',
  clear_price: 'Clear price (buy requests)',
}

const SKIP_LABEL: Record<string, string> = {
  already_done: 'Already done',
  not_found: 'Order no longer exists',
  changed: 'Order changed since the file was built',
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
  const res = await api.get(`/orders/admin/bulk-fix/${batchId}/skipped.csv`, {
    responseType: 'blob',
    timeout: 0,
  })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `bulk_fix_${batchId}_skipped.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminBulkFix() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<'' | 'preview' | 'commit' | 'undo'>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [batches, setBatches] = useState<Batch[]>([])

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get('/orders/admin/bulk-fix')
      setBatches(res.data)
    } catch (err) {
      console.error('Failed to load bulk-fix history:', err)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

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
      const res = await api.post('/orders/admin/bulk-fix/preview', form, {
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
        `/orders/admin/bulk-fix/${preview.batch_id}/commit`,
        { confirm_apply_total: confirmNumber },
        { timeout: 600000 }
      )
      const done = res.data.done as Record<Action, number>
      const total = Object.values(done).reduce((a, b) => a + b, 0)
      setNotice(
        `Done: ${fmt(total)} orders changed` +
          (res.data.failed ? `, ${fmt(res.data.failed)} left alone because they changed in the meantime` : '') +
          '. Prices and counts are refreshing in the background.'
      )
      setPreview(null)
      setFile(null)
      setConfirmText('')
      loadHistory()
    } catch (err) {
      setError(errorText(err))
      loadHistory()
    } finally {
      setBusy('')
    }
  }

  const runUndo = async (b: Batch) => {
    const n = fmt(b.result?.done ? Object.values(b.result.done).reduce((x, y) => x + y, 0) : 0)
    if (!window.confirm(`Undo "${b.file_name}"? This puts back ${n} changed orders.`)) return
    setBusy('undo')
    setError('')
    try {
      const res = await api.post(`/orders/admin/bulk-fix/${b.batch_id}/undo`, {}, { timeout: 600000 })
      setNotice(`Undone: ${fmt(res.data.restored)} orders restored, ${fmt(res.data.reverted)} edits reverted.`)
      loadHistory()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk fix of orders</h1>
        <p className="text-sm text-gray-500">
          Upload the fix file from the audit (CSV, separated by ; with order_id and action). The preview shows what
          will happen; nothing changes until you confirm. Deleted orders are archived and every batch can be undone.
          Orders that changed since the file was built are skipped.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null)
            setPreview(null)
          }}
          className="text-sm"
        />
        <button
          onClick={runPreview}
          disabled={!file || busy !== ''}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {busy === 'preview' ? 'Checking every row…' : 'Preview'}
        </button>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Preview <span className="font-normal text-gray-500">({fmt(preview.rows)} rows in the file)</span>
            </h2>
            <span className="text-xs text-gray-500">Valid until {when(preview.expires_at)}</span>
          </div>

          <div className="p-4 space-y-5">
            {preview.warnings.length > 0 && (
              <div className="space-y-1">
                {preview.warnings.map((w) => (
                  <div key={w} className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
                <div key={a} className="rounded-lg border p-3">
                  <div className="text-2xl font-semibold text-gray-900">{fmt(preview.apply[a])}</div>
                  <div className="text-xs text-gray-500">{ACTION_LABEL[a]}</div>
                </div>
              ))}
            </div>

            {preview.top_reasons.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Reasons</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {preview.top_reasons.map((r) => (
                      <tr key={`${r.action}-${r.reason}`} className="border-t">
                        <td className="py-1 pr-3 text-gray-500 w-40">{ACTION_LABEL[r.action]}</td>
                        <td className="py-1 pr-3">{r.reason || '—'}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.sample_apply.length > 0 && (
              <details>
                <summary className="text-xs font-semibold uppercase text-gray-500 cursor-pointer">
                  Examples of rows that will run
                </summary>
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1 pr-2">Action</th>
                      <th className="py-1 pr-2">Order now</th>
                      <th className="py-1 pr-2">Reason</th>
                      <th className="py-1">Dealer's line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_apply.map((s) => (
                      <tr key={s.order_id} className="border-t align-top">
                        <td className="py-1 pr-2 whitespace-nowrap">
                          {s.action}
                          {s.new_value ? ` → ${s.new_value}` : ''}
                        </td>
                        <td className="py-1 pr-2 whitespace-nowrap">
                          {s.ws_code} · {fmt(s.price)} {s.currency}
                        </td>
                        <td className="py-1 pr-2">{s.reason}</td>
                        <td className="py-1 text-gray-600">{s.source_line}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            {Object.keys(preview.skipped).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase text-gray-500">Skipped rows</h3>
                  <button
                    onClick={() => downloadSkipped(preview.batch_id)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Download className="w-3 h-3" /> Download skipped.csv
                  </button>
                </div>
                <ul className="text-sm space-y-1">
                  {Object.entries(preview.skipped).map(([k, n]) => (
                    <li key={k} className="flex justify-between border-t py-1">
                      <span>{SKIP_LABEL[k] || k}</span>
                      <span className="tabular-nums">{fmt(n)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.apply_total > 0 ? (
              <div className="border-t pt-4 flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-700">
                  Type <strong>{fmt(preview.apply_total)}</strong> to confirm
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={fmt(preview.apply_total)}
                  className="px-3 py-2 border rounded-lg text-sm w-40"
                />
                <button
                  onClick={runCommit}
                  disabled={!canCommit || busy !== ''}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                >
                  {busy === 'commit' ? 'Applying…' : `Apply ${fmt(preview.apply_total)} changes`}
                </button>
              </div>
            ) : (
              <p className="border-t pt-4 text-sm text-gray-500">Nothing in this file applies to the current orders.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">History</h2>
        </div>
        {batches.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No batches yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Planned</th>
                <th className="px-4 py-2 text-right">Done</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const done = b.result?.done ? Object.values(b.result.done).reduce((x, y) => x + y, 0) : null
                return (
                  <tr key={b.batch_id} className="border-t">
                    <td className="px-4 py-2">{b.file_name}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {when(b.created_at)}
                      {b.created_by_name ? ` · ${b.created_by_name}` : ''}
                    </td>
                    <td className="px-4 py-2">
                      {b.status}
                      {b.status === 'undone' && b.result?.restored !== undefined
                        ? ` (${fmt(b.result.restored)} restored, ${fmt(b.result.reverted)} reverted)`
                        : ''}
                      {b.result?.error ? <span className="text-red-600"> · {b.result.error}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(b.apply_total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {done === null ? '' : fmt(done)}
                      {b.result?.failed ? <span className="text-gray-500"> ({fmt(b.result.failed)} left)</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {b.status !== 'expired' && (
                        <button
                          onClick={() => downloadSkipped(b.batch_id)}
                          className="text-xs text-primary hover:underline mr-3"
                        >
                          Skipped
                        </button>
                      )}
                      {b.status === 'committed' && (
                        <button
                          onClick={() => runUndo(b)}
                          disabled={busy !== ''}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" /> Undo
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
