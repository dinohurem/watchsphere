import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileOutput,
  Link2Off,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import QRCode from 'qrcode'
import { api } from '@/services/api'

type BridgeState =
  | 'starting'
  | 'qr_required'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'logged_out'

interface BridgeStatus {
  bridge_id: string
  state: BridgeState
  phone_number?: string | null
  groups: string[]
  error?: string | null
  last_heartbeat_at: string
  last_message_at?: string | null
  messages_ingested: number
  is_stale: boolean
  qr?: string | null
  qr_generated_at?: string | null
}

interface BridgeGroup {
  group_jid: string
  group_name: string
  message_count: number
  first_message_at?: string | null
  last_message_at?: string | null
}

interface WtbWtsRun {
  id: string
  filename: string
  group_name: string
  mode: 'wts' | 'wtb'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  total_messages: number
  detected_posts: number
  matched_count: number
  needs_review_count: number
  not_in_database_count: number
  has_matched_csv: boolean
  has_needs_review_csv: boolean
  has_not_in_database_csv: boolean
  has_suggested_csv: boolean
  suggested_additions_count: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATE_STYLES: Record<BridgeState, { label: string; className: string; icon: typeof CheckCircle }> = {
  connected: { label: 'Connected', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  connecting: { label: 'Connecting', className: 'bg-amber-100 text-amber-800', icon: Clock },
  starting: { label: 'Starting', className: 'bg-gray-100 text-gray-800', icon: Clock },
  qr_required: { label: 'Pairing required', className: 'bg-blue-100 text-blue-800', icon: QrCode },
  disconnected: { label: 'Disconnected', className: 'bg-red-100 text-red-800', icon: XCircle },
  logged_out: { label: 'Logged out', className: 'bg-red-100 text-red-800', icon: Link2Off },
}

/** Backend timestamps are naive UTC — without the Z they parse as local time. */
function parseUtc(value?: string | null): Date | null {
  if (!value) return null
  return new Date(value.endsWith('Z') ? value : `${value}Z`)
}

function formatDateTime(value?: string | null): string {
  const date = parseUtc(value)
  return date ? date.toLocaleString() : '—'
}

function formatRelative(value?: string | null): string {
  const date = parseUtc(value)
  if (!date) return 'never'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

export function AdminWhatsAppBridge() {
  const [statuses, setStatuses] = useState<BridgeStatus[]>([])
  const [groups, setGroups] = useState<BridgeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)

  // Generation form
  const [selectedJid, setSelectedJid] = useState('')
  const [mode, setMode] = useState<'wts' | 'wtb'>('wts')
  const [referenceMonth, setReferenceMonth] = useState(new Date().getMonth() + 1)
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [tzOffsetMinutes, setTzOffsetMinutes] = useState(0)

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ percent: 0, detail: '' })
  const [result, setResult] = useState<WtbWtsRun | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pairingBridge = statuses.find((item) => item.qr)

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, groupsRes] = await Promise.all([
        api.get('/whatsapp-bridge/status'),
        api.get('/whatsapp-bridge/groups'),
      ])
      setStatuses(statusRes.data)
      setGroups(groupsRes.data)
      setLoadError(null)
    } catch (error: any) {
      setLoadError(error.response?.data?.detail || error.message || 'Failed to load bridge status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Poll faster while a pairing code is on screen — WhatsApp rotates it about
  // every 20 seconds and a stale code simply will not scan.
  useEffect(() => {
    const interval = setInterval(fetchAll, pairingBridge ? 5000 : 15000)
    return () => clearInterval(interval)
  }, [fetchAll, pairingBridge])

  useEffect(() => {
    let cancelled = false
    if (!pairingBridge?.qr) {
      setQrImage(null)
      return
    }
    QRCode.toDataURL(pairingBridge.qr, { width: 280, margin: 2 })
      .then((url) => {
        if (!cancelled) setQrImage(url)
      })
      .catch(() => {
        if (!cancelled) setQrImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [pairingBridge?.qr])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => stopPolling, [])

  const startPolling = (runId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}/progress`)
        const { status, progress_percent, progress_detail } = res.data
        setProgress({ percent: progress_percent, detail: progress_detail })

        if (status === 'completed' || status === 'failed') {
          stopPolling()
          const runRes = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}`)
          setGenerating(false)
          if (status === 'completed') {
            setResult(runRes.data)
            setProgress({ percent: 100, detail: 'Done' })
          } else {
            alert(`Generation failed: ${runRes.data.error_message || 'Unknown error'}`)
            setProgress({ percent: 0, detail: '' })
          }
        }
      } catch {
        // Transient polling errors are not worth interrupting the run for.
      }
    }, 1500)
  }

  const buildRange = () => ({
    start: start ? new Date(`${start}:00Z`).toISOString() : null,
    end: end ? new Date(`${end}:00Z`).toISOString() : null,
  })

  const handleGenerate = async () => {
    if (!selectedJid) return
    setGenerating(true)
    setResult(null)
    setProgress({ percent: 2, detail: 'Starting…' })

    try {
      const range = buildRange()
      const response = await api.post('/whatsapp-bridge/generate', {
        group_jid: selectedJid,
        mode,
        reference_month: referenceMonth,
        reference_year: referenceYear,
        start: range.start,
        end: range.end,
        tz_offset_minutes: tzOffsetMinutes,
      })
      startPolling(response.data.id)
    } catch (error: any) {
      const detail = error.response?.data?.detail
      alert(detail ? `Generation failed: ${detail}` : `Generation failed: ${error.message}`)
      setGenerating(false)
      setProgress({ percent: 0, detail: '' })
    }
  }

  const handleDownloadCsv = async (runId: string, type: string, prefix: string) => {
    try {
      const response = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}/${type}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${prefix}${selectedGroupName() || 'bridge'}.csv`
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      if (error.response?.status === 410) {
        alert('Files have expired. Generated files are only available for 30 minutes.')
      } else {
        alert(`Download failed: ${error.message}`)
      }
    }
  }

  const selectedGroupName = () =>
    groups.find((group) => group.group_jid === selectedJid)?.group_name ?? ''

  const handleExportTxt = async () => {
    if (!selectedJid) return
    try {
      const range = buildRange()
      const params = new URLSearchParams({ group_jid: selectedJid })
      if (range.start) params.set('start', range.start)
      if (range.end) params.set('end', range.end)
      params.set('tz_offset_minutes', String(tzOffsetMinutes))

      const response = await api.get(`/whatsapp-bridge/export?${params.toString()}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${selectedGroupName() || 'bridge'}.txt`
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      const detail = error.response?.status === 404
        ? 'No captured messages for that group and time range'
        : error.message
      alert(`Export failed: ${detail}`)
    }
  }

  const handlePurge = async (group: BridgeGroup) => {
    const days = window.prompt(
      `Delete captured messages from "${group.group_name}" older than how many days?\n\n` +
        'This only removes raw captures. Orders already imported are unaffected.',
      '90'
    )
    if (!days) return
    const parsed = Number.parseInt(days, 10)
    if (Number.isNaN(parsed) || parsed < 1) {
      alert('Enter a whole number of days (1 or more).')
      return
    }

    try {
      const response = await api.delete(
        `/whatsapp-bridge/messages?group_jid=${encodeURIComponent(group.group_jid)}&older_than_days=${parsed}`
      )
      alert(`Deleted ${response.data.deleted} message(s).`)
      fetchAll()
    } catch (error: any) {
      alert(`Purge failed: ${error.response?.data?.detail || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Loading bridge status…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">WhatsApp Bridge</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live capture from dealer groups that cannot be exported. Generate CSVs here, then
            review and import them on the WhatsApp Import page.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>{loadError}</div>
        </div>
      )}

      {/* Pairing */}
      {pairingBridge && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {qrImage && (
              <img
                src={qrImage}
                alt="WhatsApp pairing QR code"
                className="h-[280px] w-[280px] shrink-0 rounded-lg bg-white p-2"
              />
            )}
            <div className="text-sm text-blue-900">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <QrCode className="h-5 w-5" />
                Pair “{pairingBridge.bridge_id}”
              </h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>Open WhatsApp on the bridge’s phone</li>
                <li>Go to Settings → Linked devices → Link a device</li>
                <li>Scan this code</li>
              </ol>
              <p className="mt-3 text-blue-700">
                The code rotates every ~20 seconds and refreshes here automatically.
              </p>
              {pairingBridge.error && (
                <p className="mt-2 font-medium text-red-700">{pairingBridge.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bridge status */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary">Bridge status</h2>
        {statuses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            No bridge has reported in yet. Start the bridge service and it will appear here.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {statuses.map((item) => {
              const style = STATE_STYLES[item.state] ?? STATE_STYLES.starting
              const StateIcon = style.icon
              return (
                <div key={item.bridge_id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-primary">{item.bridge_id}</div>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}
                    >
                      <StateIcon className="h-3.5 w-3.5" />
                      {style.label}
                    </span>
                  </div>

                  {item.is_stale && (
                    <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        No heartbeat since {formatRelative(item.last_heartbeat_at)} — the bridge may
                        be down. It reports as healthy only while it is actually running.
                      </span>
                    </div>
                  )}

                  {item.error && !item.is_stale && (
                    <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                      {item.error}
                    </div>
                  )}

                  <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-gray-500">Number</dt>
                    <dd className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                      {item.phone_number || '—'}
                    </dd>

                    <dt className="text-gray-500">Groups</dt>
                    <dd className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {item.groups.length > 0 ? item.groups.join(', ') : '—'}
                    </dd>

                    <dt className="text-gray-500">Captured</dt>
                    <dd>{item.messages_ingested.toLocaleString()} messages</dd>

                    <dt className="text-gray-500">Last message</dt>
                    <dd>{formatRelative(item.last_message_at)}</dd>

                    <dt className="text-gray-500">Last heartbeat</dt>
                    <dd>{formatRelative(item.last_heartbeat_at)}</dd>
                  </dl>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Captured groups */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary">Captured groups</h2>
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            Nothing captured yet. Check that BRIDGE_GROUPS lists the groups you want — an empty
            allowlist captures nothing by design.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Messages</th>
                  <th className="px-4 py-3">First capture</th>
                  <th className="px-4 py-3">Last capture</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map((group) => (
                  <tr
                    key={group.group_jid}
                    className={selectedJid === group.group_jid ? 'bg-accent/10' : undefined}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{group.group_name}</div>
                      <div className="text-xs text-gray-400">{group.group_jid}</div>
                    </td>
                    <td className="px-4 py-3">{group.message_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateTime(group.first_message_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateTime(group.last_message_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedJid(group.group_jid)}
                          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                        >
                          {selectedJid === group.group_jid ? 'Selected' : 'Select'}
                        </button>
                        <button
                          onClick={() => handlePurge(group)}
                          title="Delete old captures"
                          className="rounded border border-gray-300 p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate */}
      {selectedJid && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <FileOutput className="h-5 w-5" />
            Generate from “{selectedGroupName()}”
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Runs the same generator as an uploaded export. Nothing reaches the order book until you
            import the CSVs.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as 'wts' | 'wtb')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="wts">WTS (selling)</option>
                <option value="wtb">WTB (buying)</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Reference month</span>
              <select
                value={referenceMonth}
                onChange={(event) => setReferenceMonth(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Reference year</span>
              <input
                type="number"
                value={referenceYear}
                onChange={(event) => setReferenceYear(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">From (UTC, optional)</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">To (UTC, optional)</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Timestamp offset (minutes)
              </span>
              <input
                type="number"
                value={tzOffsetMinutes}
                onChange={(event) => setTzOffsetMinutes(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-gray-400">
                Shifts captured UTC times to the group’s local time, so dates match a manual export.
              </span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileOutput className="h-4 w-4" />
              )}
              {generating ? 'Generating…' : 'Generate CSVs'}
            </button>
            <button
              onClick={handleExportTxt}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download .txt export
            </button>
          </div>

          {generating && (
            <div className="mt-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {progress.detail || 'Processing…'} ({progress.percent}%)
              </p>
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 font-medium text-green-900">
                <CheckCircle className="h-5 w-5" />
                {result.total_messages.toLocaleString()} messages processed —{' '}
                {result.matched_count.toLocaleString()} matched,{' '}
                {result.needs_review_count.toLocaleString()} need review,{' '}
                {result.not_in_database_count.toLocaleString()} not in database
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.has_matched_csv && (
                  <button
                    onClick={() => handleDownloadCsv(result.id, 'matched-csv', 'matched-')}
                    className="flex items-center gap-1.5 rounded border border-green-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-green-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Matched ({result.matched_count})
                  </button>
                )}
                {result.has_needs_review_csv && (
                  <button
                    onClick={() => handleDownloadCsv(result.id, 'needs-review-csv', 'needs-review-')}
                    className="flex items-center gap-1.5 rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Needs review ({result.needs_review_count})
                  </button>
                )}
                {result.has_not_in_database_csv && (
                  <button
                    onClick={() =>
                      handleDownloadCsv(result.id, 'not-in-database-csv', 'not-in-database-')
                    }
                    className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Not in database ({result.not_in_database_count})
                  </button>
                )}
                {result.has_suggested_csv && (
                  <button
                    onClick={() => handleDownloadCsv(result.id, 'suggested-csv', 'suggested-')}
                    className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Suggested additions ({result.suggested_additions_count})
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-green-800">
                Files expire after 30 minutes. Import the matched CSV on the WhatsApp Import page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
