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
  RotateCcw,
  FileOutput,
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
  has_matched_csv: boolean
  has_needs_review_csv: boolean
  reprocessed_from?: string
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

export function AdminWtbWtsGenerator() {
  const [runs, setRuns] = useState<WtbWtsRun[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<WtbWtsRun | null>(null)

  // Form state
  const [mode, setMode] = useState<'wts' | 'wtb'>('wts')
  const [groupName, setGroupName] = useState('')
  const [referenceMonth, setReferenceMonth] = useState(new Date().getMonth() + 1)
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear())
  const [txtFile, setTxtFile] = useState<File | null>(null)
  const [jsonlFile, setJsonlFile] = useState<File | null>(null)
  const txtInputRef = useRef<HTMLInputElement>(null)
  const jsonlInputRef = useRef<HTMLInputElement>(null)

  // Reprocess modal state
  const [reprocessRun, setReprocessRun] = useState<WtbWtsRun | null>(null)
  const [reprocessMode, setReprocessMode] = useState<'wts' | 'wtb'>('wts')
  const [reprocessGroup, setReprocessGroup] = useState('')
  const [reprocessMonth, setReprocessMonth] = useState(1)
  const [reprocessYear, setReprocessYear] = useState(new Date().getFullYear())
  const [reprocessing, setReprocessing] = useState(false)

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

  const handleGenerate = async () => {
    if (!txtFile || !groupName.trim()) return

    setGenerating(true)
    setResult(null)

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
        timeout: 300000,
      })
      setResult(response.data)
      setRuns((prev) => [response.data, ...prev])
      // Reset form
      setTxtFile(null)
      setJsonlFile(null)
      if (txtInputRef.current) txtInputRef.current.value = ''
      if (jsonlInputRef.current) jsonlInputRef.current.value = ''
    } catch (error: any) {
      console.error('Generation failed:', error)
      alert(error.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (
    runId: string,
    type: 'matched-csv' | 'needs-review-csv' | 'original-file',
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
      const prefix = type === 'matched-csv' ? 'matched-' : type === 'needs-review-csv' ? 'needs-review-' : ''
      a.download = type === 'original-file' ? filename : `${prefix}${csvFilename}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`Failed to download ${type}:`, error)
    }
  }

  const openReprocessModal = (run: WtbWtsRun) => {
    setReprocessRun(run)
    setReprocessMode(run.mode)
    setReprocessGroup(run.group_name)
    setReprocessMonth(run.reference_month)
    setReprocessYear(run.reference_year)
  }

  const handleReprocess = async () => {
    if (!reprocessRun) return

    setReprocessing(true)

    const formData = new FormData()
    formData.append('mode', reprocessMode)
    formData.append('group_name', reprocessGroup.trim())
    formData.append('reference_month', String(reprocessMonth))
    formData.append('reference_year', String(reprocessYear))

    try {
      const response = await api.post(
        `/wtb-wts/admin/wtb-wts/runs/${reprocessRun.id}/reprocess`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
        }
      )
      setRuns((prev) => [response.data, ...prev])
      setReprocessRun(null)
    } catch (error: any) {
      console.error('Reprocess failed:', error)
      alert(error.response?.data?.detail || 'Reprocess failed')
    } finally {
      setReprocessing(false)
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
            </div>

            {/* Download Buttons */}
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
            </div>
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
                        {run.reprocessed_from && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                            Re-processed
                          </span>
                        )}
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
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${STATUS_COLORS[run.status]}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {run.status}
                    </span>
                    {/* Download buttons */}
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
                    <button
                      onClick={() => handleDownload(run.id, 'original-file', run.filename)}
                      className="p-2 hover:bg-gray-200 rounded-lg text-gray-500"
                      title="Download original file"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {run.status === 'completed' && (
                      <button
                        onClick={() => openReprocessModal(run)}
                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                        title="Reprocess"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
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

      {/* Reprocess Modal */}
      {reprocessRun && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Reprocess Run</h2>
                <p className="text-sm text-gray-500">{reprocessRun.filename}</p>
              </div>
              <button
                onClick={() => setReprocessRun(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
                <div className="flex gap-0">
                  <button
                    type="button"
                    onClick={() => setReprocessMode('wts')}
                    className={`px-5 py-2 text-sm font-medium rounded-l-lg border transition-colors ${
                      reprocessMode === 'wts'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    WTS
                  </button>
                  <button
                    type="button"
                    onClick={() => setReprocessMode('wtb')}
                    className={`px-5 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                      reprocessMode === 'wtb'
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
                  value={reprocessGroup}
                  onChange={(e) => setReprocessGroup(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Reference Month/Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={reprocessMonth}
                    onChange={(e) => setReprocessMonth(Number(e.target.value))}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={reprocessYear}
                    onChange={(e) => setReprocessYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setReprocessRun(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReprocess}
                disabled={reprocessing || !reprocessGroup.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {reprocessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Re-processing...
                  </>
                ) : (
                  'Re-process'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
