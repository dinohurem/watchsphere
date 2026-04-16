import { useEffect, useState, useRef } from 'react'
import {
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  AlertTriangle,
  FileText,
  X,
  FileOutput,
  HelpCircle,
} from 'lucide-react'
import { api } from '@/services/api'

interface WtbWtsRun {
  id: string
  filename: string
  group_name: string
  mode: 'wts' | 'wtb'
  reference_month: number
  reference_year: number
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
  files_expire_at?: string
  imported_by: string
  imported_by_name: string
  created_at: string
  completed_at?: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const STATUS_ICONS = {
  pending: Clock,
  processing: Clock,
  completed: CheckCircle,
  failed: XCircle,
}

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function isFilesExpired(run: WtbWtsRun): boolean {
  if (run.status !== 'completed') return false
  // Files are expired when none of the CSVs are available
  return (
    !run.has_matched_csv &&
    !run.has_needs_review_csv &&
    !run.has_not_in_database_csv &&
    !run.has_suggested_csv
  )
}

function getTimeRemaining(run: WtbWtsRun): string | null {
  if (!run.files_expire_at || isFilesExpired(run)) return null
  // Append Z if missing to ensure UTC parsing
  const expireStr = run.files_expire_at.endsWith('Z') ? run.files_expire_at : run.files_expire_at + 'Z'
  const diff = new Date(expireStr).getTime() - Date.now()
  if (diff <= 0) return null
  const mins = Math.ceil(diff / 60000)
  return `${mins} min left`
}

export function AdminWtbWtsGenerator() {
  const [runs, setRuns] = useState<WtbWtsRun[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<WtbWtsRun | null>(null)
  const [progress, setProgress] = useState({ percent: 0, stage: '', detail: '' })
  const [displayPercent, setDisplayPercent] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creepRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const targetPercentRef = useRef(0)

  // Form state
  const [mode, setMode] = useState<'wts' | 'wtb'>('wts')
  const [groupName, setGroupName] = useState('')
  const [referenceMonth, setReferenceMonth] = useState(new Date().getMonth() + 1)
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear())
  const [txtFile, setTxtFile] = useState<File | null>(null)
  const [jsonlFile, setJsonlFile] = useState<File | null>(null)
  const txtInputRef = useRef<HTMLInputElement>(null)
  const jsonlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchRuns()
  }, [])

  const fetchRuns = async () => {
    try {
      const response = await api.get('/wtb-wts/admin/wtb-wts/runs')
      setRuns(response.data)
    } catch (error) {
      console.error('Failed to fetch runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const stopCreep = () => {
    if (creepRef.current) {
      clearInterval(creepRef.current)
      creepRef.current = null
    }
  }

  const startCreep = () => {
    stopCreep()
    creepRef.current = setInterval(() => {
      setDisplayPercent((prev) => {
        const target = targetPercentRef.current
        if (prev >= target) {
          // Slowly creep toward next milestone (never exceed target + 8)
          const ceiling = Math.min(target + 8, 99)
          if (prev >= ceiling) return prev
          return prev + 0.2
        }
        // Catch up to actual target quickly
        const gap = target - prev
        return prev + Math.max(gap * 0.15, 0.3)
      })
    }, 200)
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    stopCreep()
  }

  const startPolling = (runId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}/progress`)
        const { status: runStatus, progress_percent, progress_stage, progress_detail } = res.data
        targetPercentRef.current = progress_percent
        setProgress({ percent: progress_percent, stage: progress_stage, detail: progress_detail })
        // Drive the progress bar directly from the backend value
        if (progress_percent > 0) {
          setDisplayPercent((prev) => Math.max(prev, progress_percent))
        }

        if (runStatus === 'completed' || runStatus === 'failed') {
          stopPolling()
          setDisplayPercent(runStatus === 'completed' ? 100 : 0)
          // Fetch the final run data
          const runRes = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}`)
          if (runStatus === 'completed') {
            setResult(runRes.data)
            setRuns((prev) => prev.map((r) => (r.id === runId ? runRes.data : r)))
          } else {
            alert(`Processing failed: ${runRes.data.error_message || 'Unknown error'}`)
            setRuns((prev) => prev.map((r) => (r.id === runId ? runRes.data : r)))
          }
          setGenerating(false)
          setTxtFile(null)
          setJsonlFile(null)
          if (txtInputRef.current) txtInputRef.current.value = ''
          if (jsonlInputRef.current) jsonlInputRef.current.value = ''
        }
      } catch {
        // Ignore polling errors
      }
    }, 1500)
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handleGenerate = async () => {
    if (!txtFile || !groupName.trim()) return

    setGenerating(true)
    setResult(null)
    setDisplayPercent(0)
    targetPercentRef.current = 0
    setProgress({ percent: 0, stage: 'uploading', detail: 'Uploading file...' })

    const formData = new FormData()
    formData.append('file', txtFile)
    formData.append('mode', mode)
    formData.append('group_name', groupName.trim())
    formData.append('reference_month', String(referenceMonth))
    formData.append('reference_year', String(referenceYear))
    if (jsonlFile) {
      formData.append('jsonl_file', jsonlFile)
    }

    try {
      const response = await api.post('/wtb-wts/admin/wtb-wts/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      // Run created — start polling for progress
      const run = response.data
      setRuns((prev) => [run, ...prev])
      setDisplayPercent(2)
      targetPercentRef.current = 2
      setProgress({ percent: 2, stage: 'started', detail: 'Processing started...' })
      startCreep()
      startPolling(run.id)
    } catch (error: any) {
      console.error('Generation failed:', error)
      const detail = error.response?.data?.detail
      const errStatus = error.response?.status
      const message = detail
        ? `Processing failed (${errStatus}): ${detail}`
        : error.code === 'ECONNABORTED'
          ? 'Request timed out — file may be too large'
          : `Generation failed: ${error.message || 'Network error'}`
      alert(message)
      setGenerating(false)
    }
  }

  const handleDownload = async (
    runId: string,
    type: 'matched-csv' | 'needs-review-csv' | 'not-in-database-csv' | 'suggested-csv',
    filename: string
  ) => {
    try {
      const response = await api.get(`/wtb-wts/admin/wtb-wts/runs/${runId}/${type}`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const csvFilename = filename.replace(/\.txt$/i, '.csv')
      const prefix =
        type === 'matched-csv'
          ? 'matched-'
          : type === 'suggested-csv'
            ? 'suggested-'
            : type === 'not-in-database-csv'
              ? 'not-in-database-'
              : 'needs-review-'
      a.download = `${prefix}${csvFilename}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      if (error.response?.status === 410) {
        alert('Files have expired. Generated files are only available for 30 minutes.')
        fetchRuns() // Refresh to update UI
      } else {
        console.error(`Failed to download ${type}:`, error)
      }
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">WTB/WTS Generator</h1>
        <p className="text-gray-600">
          Generate matched CSV files from WhatsApp group chat exports
        </p>
      </div>

      {/* Input Form Section */}
      <div className="bg-white rounded-lg border shadow-sm mb-6">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Generate</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => setMode('wts')}
                className={`px-5 py-2 text-sm font-medium rounded-l-lg border transition-colors ${
                  mode === 'wts'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                WTS
              </button>
              <button
                type="button"
                onClick={() => setMode('wtb')}
                className={`px-5 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                  mode === 'wtb'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                WTB
              </button>
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Rolex Market EU"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Reference Month/Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Month
              </label>
              <select
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {MONTHS.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Year</label>
              <input
                type="number"
                value={referenceYear}
                onChange={(e) => setReferenceYear(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* TXT File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chat Export (.txt)
            </label>
            {txtFile ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-sm text-gray-700 truncate">{txtFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTxtFile(null)
                    if (txtInputRef.current) txtInputRef.current.value = ''
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400"
                onClick={() => txtInputRef.current?.click()}
              >
                <input
                  ref={txtInputRef}
                  type="file"
                  accept=".txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setTxtFile(file)
                  }}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Click to select a .txt file
                </p>
              </div>
            )}
          </div>

          {/* JSONL File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Watch Database (.jsonl){' '}
              <span className="text-gray-400 font-normal">
                — optional, uses app database if not provided
              </span>
            </label>
            {jsonlFile ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="flex-1 text-sm text-gray-700 truncate">{jsonlFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setJsonlFile(null)
                    if (jsonlInputRef.current) jsonlInputRef.current.value = ''
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400"
                onClick={() => jsonlInputRef.current?.click()}
              >
                <input
                  ref={jsonlInputRef}
                  type="file"
                  accept=".jsonl"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setJsonlFile(file)
                  }}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Click to select a .jsonl file
                </p>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!txtFile || !groupName.trim() || generating}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {generating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>

          {/* Progress Bar */}
          {generating && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(displayPercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{progress.detail || 'Starting...'}</span>
                <span>{Math.round(displayPercent)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Summary */}
      {result && (
        <div className="bg-white rounded-lg border shadow-sm mb-6 overflow-hidden">
          {/* Header bar */}
          <div
            className={`px-4 py-3 flex items-center gap-2 ${
              result.needs_review_count > 0
                ? 'bg-amber-50 border-b border-amber-200'
                : 'bg-green-50 border-b border-green-200'
            }`}
          >
            {result.needs_review_count > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            <span
              className={`font-medium ${
                result.needs_review_count > 0 ? 'text-amber-800' : 'text-green-800'
              }`}
            >
              {result.needs_review_count > 0
                ? 'Generation completed with items needing review'
                : 'Generation completed successfully'}
            </span>
            {result.files_expire_at && !isFilesExpired(result) && (
              <span className="ml-auto text-xs text-gray-400">
                Download available for {getTimeRemaining(result)}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-lg font-bold text-gray-900">{result.total_messages}</p>
                <p className="text-xs text-gray-500">Total Messages</p>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded">
                <p className="text-lg font-bold text-blue-700">{result.detected_posts}</p>
                <p className="text-xs text-gray-500">
                  {result.mode.toUpperCase()} Posts Detected
                </p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-lg font-bold text-green-700">{result.matched_count}</p>
                <p className="text-xs text-gray-500">Matched</p>
              </div>
              <div
                className={`text-center p-2 rounded ${
                  result.needs_review_count > 0 ? 'bg-amber-50' : 'bg-gray-50'
                }`}
              >
                <p
                  className={`text-lg font-bold ${
                    result.needs_review_count > 0 ? 'text-amber-700' : 'text-gray-900'
                  }`}
                >
                  {result.needs_review_count}
                </p>
                <p className="text-xs text-gray-500">Needs Review</p>
              </div>
              {(result.not_in_database_count || 0) > 0 && (
                <div className="text-center p-2 bg-rose-50 rounded">
                  <p className="text-lg font-bold text-rose-700">
                    {result.not_in_database_count}
                  </p>
                  <p className="text-xs text-gray-500">Not in Database</p>
                </div>
              )}
              {(result.suggested_additions_count || 0) > 0 && (
                <div className="text-center p-2 bg-indigo-50 rounded">
                  <p className="text-lg font-bold text-indigo-700">
                    {result.suggested_additions_count}
                  </p>
                  <p className="text-xs text-gray-500">Suggested Additions</p>
                </div>
              )}
            </div>

            {/* Download Buttons */}
            {isFilesExpired(result) ? (
              <p className="text-sm text-gray-400 italic">
                Files expired. Re-upload the chat export to generate again.
              </p>
            ) : (
              <div className="flex gap-3">
                {result.has_matched_csv && (
                  <button
                    onClick={() => handleDownload(result.id, 'matched-csv', result.filename)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-800 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Matched CSV
                  </button>
                )}
                {result.has_needs_review_csv && (
                  <button
                    onClick={() => handleDownload(result.id, 'needs-review-csv', result.filename)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Needs Review CSV
                  </button>
                )}
                {result.has_not_in_database_csv && (
                  <button
                    onClick={() =>
                      handleDownload(result.id, 'not-in-database-csv', result.filename)
                    }
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-rose-800 bg-rose-100 border border-rose-300 rounded-lg hover:bg-rose-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Not in Database CSV
                  </button>
                )}
                {result.has_suggested_csv && (
                  <button
                    onClick={() => handleDownload(result.id, 'suggested-csv', result.filename)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-800 bg-indigo-100 border border-indigo-300 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Suggested Additions ({result.suggested_additions_count || 0})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Panel */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <button onClick={fetchRuns} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y">
          {runs.map((run) => {
            const StatusIcon = STATUS_ICONS[run.status]
            const expired = isFilesExpired(run)
            const timeLeft = getTimeRemaining(run)
            return (
              <div key={run.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileOutput className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{run.group_name}</p>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            run.mode === 'wts'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {run.mode.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{run.filename}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {run.matched_count} matched
                        {run.needs_review_count > 0 && (
                          <span className="text-amber-600">
                            {' '}
                            / {run.needs_review_count} review
                          </span>
                        )}
                        {(run.not_in_database_count || 0) > 0 && (
                          <span className="text-rose-600">
                            {' '}
                            / {run.not_in_database_count} not in DB
                          </span>
                        )}
                        {(run.suggested_additions_count || 0) > 0 && (
                          <span className="text-indigo-600">
                            {' '}
                            / {run.suggested_additions_count} suggested
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${STATUS_COLORS[run.status]}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {run.status}
                    </span>
                    {/* Download buttons — only if files haven't expired */}
                    {run.status === 'completed' && !expired && (
                      <>
                        {run.has_matched_csv && (
                          <button
                            onClick={() => handleDownload(run.id, 'matched-csv', run.filename)}
                            className="p-2 hover:bg-green-100 rounded-lg text-green-600"
                            title="Download matched CSV"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {run.has_needs_review_csv && (
                          <button
                            onClick={() => handleDownload(run.id, 'needs-review-csv', run.filename)}
                            className="p-2 hover:bg-amber-100 rounded-lg text-amber-600"
                            title="Download needs review CSV"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {run.has_not_in_database_csv && (
                          <button
                            onClick={() =>
                              handleDownload(run.id, 'not-in-database-csv', run.filename)
                            }
                            className="p-2 hover:bg-rose-100 rounded-lg text-rose-600"
                            title={`Download not-in-database CSV (${run.not_in_database_count || 0})`}
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        )}
                        {run.has_suggested_csv && (
                          <button
                            onClick={() => handleDownload(run.id, 'suggested-csv', run.filename)}
                            className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600"
                            title={`Download suggested additions (${run.suggested_additions_count || 0})`}
                          >
                            <FileOutput className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    {run.status === 'completed' && expired && (
                      <span className="text-xs text-gray-400 italic">expired</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>Imported by: {run.imported_by_name}</span>
                  <span>Created: {formatDate(run.created_at)}</span>
                  <span>
                    Ref: {MONTHS[run.reference_month - 1]} {run.reference_year}
                  </span>
                  {run.status === 'completed' && (
                    <span>
                      {run.total_messages} messages, {run.detected_posts}{' '}
                      {run.mode.toUpperCase()} posts detected
                    </span>
                  )}
                  {run.status === 'completed' && !expired && timeLeft && (
                    <span className="text-blue-500">{timeLeft}</span>
                  )}
                  {run.error_message && (
                    <span className="text-red-500">Error: {run.error_message}</span>
                  )}
                </div>
              </div>
            )
          })}

          {runs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No runs yet. Upload a chat export to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
