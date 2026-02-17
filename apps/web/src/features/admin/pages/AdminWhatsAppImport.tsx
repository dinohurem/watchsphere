import { useEffect, useState, useRef } from 'react'
import { Upload, FileArchive, CheckCircle, XCircle, Clock, Search, Eye, X, RefreshCw, Download, AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'

interface WhatsAppImport {
  id: string
  filename: string
  group_name: string
  status: 'processing' | 'completed' | 'failed'
  total_messages: number
  extracted_watches: number
  imported_by: string
  imported_by_name: string
  created_at: string
  completed_at?: string
  error_message?: string
  matched_orders: number
  unmatched_rows: number
  skipped_duplicates: number
  has_unmatched_csv: boolean
}

interface ExtractedListing {
  id: string
  import_id: string
  brand?: string
  reference?: string
  ws_code?: string
  model?: string
  price?: number
  currency: string
  condition?: string
  seller_name?: string
  raw_text: string
  month_year?: string
  message_timestamp?: string
}

interface ImportResult {
  import: WhatsAppImport
  isCSV: boolean
}

const STATUS_ICONS = {
  processing: Clock,
  completed: CheckCircle,
  failed: XCircle,
}

const STATUS_COLORS = {
  processing: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function AdminWhatsAppImport() {
  const [imports, setImports] = useState<WhatsAppImport[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedImport, setSelectedImport] = useState<WhatsAppImport | null>(null)
  const [listings, setListings] = useState<ExtractedListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ExtractedListing[]>([])
  const [searching, setSearching] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchImports()
  }, [])

  const fetchImports = async () => {
    try {
      const response = await api.get('/whatsapp/admin/whatsapp/imports')
      setImports(response.data)
    } catch (error) {
      console.error('Failed to fetch imports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip') && !file.name.endsWith('.csv')) {
      alert('Please select a .zip or .csv file')
      return
    }

    const isCSV = file.name.endsWith('.csv')
    setUploading(true)
    setUploadProgress(0)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post('/whatsapp/admin/whatsapp/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes for large file processing
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0
          setUploadProgress(progress)
        },
      })

      // Add the new import to the list
      setImports([response.data, ...imports])
      setImportResult({ import: response.data, isCSV })
    } catch (error: any) {
      console.error('Upload failed:', error)
      alert(error.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownloadUnmatched = async (importId: string, filename: string) => {
    try {
      const response = await api.get(`/whatsapp/admin/whatsapp/imports/${importId}/unmatched-csv`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `unmatched-${filename}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download unmatched CSV:', error)
    }
  }

  const handleViewListings = async (imp: WhatsAppImport) => {
    setSelectedImport(imp)
    setListingsLoading(true)

    try {
      const response = await api.get(`/whatsapp/admin/whatsapp/imports/${imp.id}/listings`)
      setListings(response.data)
    } catch (error) {
      console.error('Failed to fetch listings:', error)
    } finally {
      setListingsLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const params = new URLSearchParams()
      // Try to determine if it's a brand or reference search
      if (searchTerm.match(/^[A-Z0-9-]+$/i)) {
        params.append('reference', searchTerm)
      } else {
        params.append('brand', searchTerm)
      }
      params.append('limit', '50')

      const response = await api.get(`/whatsapp/admin/whatsapp/search?${params.toString()}`)
      setSearchResults(response.data.results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const isCSVImport = (imp: WhatsAppImport) => {
    return imp.filename.endsWith('.csv')
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
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Import</h1>
        <p className="text-gray-600">Import and analyze WhatsApp chat exports for market data</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg border shadow-sm mb-6">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Upload WhatsApp Export</h2>
        </div>
        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              uploading ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                </div>
                <p className="text-gray-700 font-medium mb-2">Uploading and processing...</p>
                <div className="w-64 mx-auto bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium mb-1">
                  Drag and drop a .zip or .csv file here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Upload WhatsApp chat export (.zip) or CSV import file
                </p>
              </>
            )}
          </div>

          {/* Import Result Summary */}
          {importResult && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              {/* Success header */}
              <div className={`px-4 py-3 flex items-center gap-2 ${
                importResult.import.unmatched_rows > 0
                  ? 'bg-amber-50 border-b border-amber-200'
                  : 'bg-green-50 border-b border-green-200'
              }`}>
                {importResult.import.unmatched_rows > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                <span className={`font-medium ${
                  importResult.import.unmatched_rows > 0 ? 'text-amber-800' : 'text-green-800'
                }`}>
                  {importResult.import.unmatched_rows > 0
                    ? 'Import completed with unmatched rows'
                    : 'Import completed successfully'}
                </span>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-lg font-bold text-gray-900">{importResult.import.total_messages}</p>
                    <p className="text-xs text-gray-500">Total Rows</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-lg font-bold text-green-700">{importResult.import.matched_orders}</p>
                    <p className="text-xs text-gray-500">Orders Created</p>
                  </div>
                  <div className={`text-center p-2 rounded ${importResult.import.unmatched_rows > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <p className={`text-lg font-bold ${importResult.import.unmatched_rows > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                      {importResult.import.unmatched_rows}
                    </p>
                    <p className="text-xs text-gray-500">Unmatched</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-lg font-bold text-gray-500">{importResult.import.skipped_duplicates}</p>
                    <p className="text-xs text-gray-500">Skipped Dupes</p>
                  </div>
                </div>

                {importResult.import.unmatched_rows > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 mb-2">
                      <strong>{importResult.import.unmatched_rows} row{importResult.import.unmatched_rows !== 1 ? 's' : ''}</strong> could not be matched to existing watches.
                      Create the missing watches in the Market section, then reimport the unmatched CSV below.
                      Duplicates will be automatically skipped.
                    </p>
                    {importResult.import.has_unmatched_csv && (
                      <button
                        onClick={() => handleDownloadUnmatched(importResult.import.id, importResult.import.filename)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Unmatched Rows CSV
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg border shadow-sm mb-6">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Search Market Data</h2>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by brand (Rolex) or reference (126610LN)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">{searchResults.length} results found</p>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {searchResults.map((listing) => (
                  <div key={listing.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{listing.brand || 'Unknown'}</span>
                        {(listing.ws_code || listing.reference) && (
                          <span className="ml-2 text-sm text-gray-500">{listing.ws_code || listing.reference}</span>
                        )}
                      </div>
                      {listing.price && (
                        <span className="font-medium text-green-600">
                          {listing.currency} {listing.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">{listing.raw_text}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      {listing.seller_name && <span>Seller: {listing.seller_name}</span>}
                      {listing.condition && <span>Condition: {listing.condition}</span>}
                      {listing.month_year && <span>{listing.month_year}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import History */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import History</h2>
          <button
            onClick={fetchImports}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y">
          {imports.map((imp) => {
            const StatusIcon = STATUS_ICONS[imp.status]
            const csv = isCSVImport(imp)
            return (
              <div key={imp.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileArchive className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{imp.group_name}</p>
                      <p className="text-sm text-gray-500">{imp.filename}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {csv && imp.status === 'completed' ? (
                        <>
                          <p className="text-sm font-medium">
                            {imp.matched_orders} orders created
                          </p>
                          <p className="text-sm text-gray-500">
                            {imp.unmatched_rows > 0 && (
                              <span className="text-amber-600">{imp.unmatched_rows} unmatched</span>
                            )}
                            {imp.unmatched_rows > 0 && imp.skipped_duplicates > 0 && ' · '}
                            {imp.skipped_duplicates > 0 && (
                              <span className="text-gray-400">{imp.skipped_duplicates} dupes skipped</span>
                            )}
                            {imp.unmatched_rows === 0 && imp.skipped_duplicates === 0 && (
                              <span>{imp.total_messages} rows processed</span>
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">
                            {imp.total_messages} messages
                          </p>
                          <p className="text-sm text-gray-500">
                            {imp.extracted_watches} watches extracted
                          </p>
                        </>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${STATUS_COLORS[imp.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                      {imp.status}
                    </span>
                    {imp.has_unmatched_csv && (
                      <button
                        onClick={() => handleDownloadUnmatched(imp.id, imp.filename)}
                        className="p-2 hover:bg-amber-100 rounded-lg text-amber-600"
                        title="Download unmatched rows CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {imp.status === 'completed' && imp.extracted_watches > 0 && (
                      <button
                        onClick={() => handleViewListings(imp)}
                        className="p-2 hover:bg-gray-200 rounded-lg"
                        title="View extracted listings"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>Imported by: {imp.imported_by_name}</span>
                  <span>Created: {formatDate(imp.created_at)}</span>
                  {imp.completed_at && <span>Completed: {formatDate(imp.completed_at)}</span>}
                  {imp.error_message && (
                    <span className="text-red-500">Error: {imp.error_message}</span>
                  )}
                </div>
              </div>
            )
          })}

          {imports.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No imports yet. Upload a WhatsApp chat export to get started.
            </div>
          )}
        </div>
      </div>

      {/* Listings Modal */}
      {selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Extracted Watch Listings</h2>
                <p className="text-sm text-gray-500">{selectedImport.group_name}</p>
              </div>
              <button onClick={() => setSelectedImport(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {listingsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((listing) => (
                    <div key={listing.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {listing.brand && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                              {listing.brand}
                            </span>
                          )}
                          {(listing.ws_code || listing.reference) && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-sm font-mono rounded">
                              {listing.ws_code || listing.reference}
                            </span>
                          )}
                          {listing.condition && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              {listing.condition}
                            </span>
                          )}
                          {listing.month_year && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                              {listing.month_year}
                            </span>
                          )}
                        </div>
                        {listing.price && (
                          <span className="text-lg font-bold text-green-600">
                            {listing.currency} {listing.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{listing.raw_text}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {listing.seller_name && <span>Seller: {listing.seller_name}</span>}
                      </div>
                    </div>
                  ))}

                  {listings.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No watch listings extracted from this import
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center p-4 border-t">
              <p className="text-sm text-gray-500">{listings.length} listings</p>
              <button
                onClick={() => setSelectedImport(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
