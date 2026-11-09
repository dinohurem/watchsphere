import { useEffect, useState } from 'react'
import { Check, EyeOff, Eye, Pencil, Trash2, X } from 'lucide-react'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

export interface WatchSummary {
  id: string
  ws_code: string
  brand: string
  model: string
  reference?: string | null
  image?: string | null
  status?: string
}

export interface OutlierInfo {
  median_usd: number
  median: number
  deviation_pct: number
  basis_year: number | null
  tolerance_pct: number
  is_outlier: boolean
}

export interface PriceListing {
  id: string
  ws_code: string
  price: number | null
  currency: string | null
  converted: number | null
  condition: string | null
  year: number | null
  month: number | null
  fresh: boolean
  created_at: string
  dealer_phone: string | null
  dealer_name: string | null
  country_code: string | null
  source_text: string | null
  source_group: string | null
  remarks: string | null
  match_method: string | null
  excluded: boolean
  outlier: OutlierInfo | null
  not_counted_reason?: string
}

export const CURRENCIES = ['EUR', 'HKD', 'AED', 'GBP', 'CHF', 'USD', 'CNY', 'JPY', 'SGD']

export function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) return '–'
  return `${Math.round(value).toLocaleString('de-DE')}${currency ? ` ${currency}` : ''}`
}

export function formatDate(iso?: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE')
}

/** Images behind admin auth: fetched with the bearer token and shown as a blob URL. */
export function AuthImage({ src, className, alt = '' }: { src?: string | null; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!src) return
    let objectUrl: string | null = null
    let cancelled = false
    const path = src.replace(/^\/api\/v1/, '')
    api
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])
  if (!src) return null
  if (!url) return <div className={cn('bg-gray-100 rounded', className)} />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className={cn('object-cover rounded', className)} />
    </a>
  )
}

/** Correct price · Exclude from median · Delete (price check page, suspicious prices tab). */
export function ListingActions({
  listing,
  onChanged,
}: {
  listing: PriceListing
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(listing.price ?? ''))
  const [currency, setCurrency] = useState(listing.currency || 'USD')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (error) {
      console.error(error)
      alert('Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-28 px-2 py-1 border rounded text-sm"
          inputMode="decimal"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="px-1 py-1 border rounded text-sm"
        >
          {[...CURRENCIES, 'USDT'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          disabled={busy}
          title="Save"
          className="p-1.5 rounded hover:bg-gray-100"
          onClick={() =>
            run(async () => {
              const value = Number(price.replace(/[^\d.]/g, ''))
              if (!value) throw new Error('invalid price')
              await api.post(`/price-check/orders/${listing.id}/correct-price`, { price: value, currency })
              setEditing(false)
            })
          }
        >
          <Check className="w-4 h-4 text-green-700" />
        </button>
        <button title="Cancel" className="p-1.5 rounded hover:bg-gray-100" onClick={() => setEditing(false)}>
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={busy}
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
      >
        <Pencil className="w-3 h-3" /> Correct price
      </button>
      <button
        disabled={busy}
        onClick={() =>
          run(() => api.post(`/price-check/orders/${listing.id}/exclude`, { excluded: !listing.excluded }))
        }
        className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
      >
        {listing.excluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        {listing.excluded ? 'Include in median' : 'Exclude from median'}
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (!confirm('Delete this listing everywhere?')) return
          run(() => api.delete(`/price-check/orders/${listing.id}`))
        }}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  )
}

export function OutlierBadge({ outlier }: { outlier: OutlierInfo | null }) {
  if (!outlier) return <span className="text-xs text-gray-400">no basis</span>
  const sign = outlier.deviation_pct > 0 ? '+' : ''
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 text-xs rounded',
        outlier.is_outlier ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
      )}
      title={`Median ${formatMoney(outlier.median)} for ${outlier.basis_year ?? 'no year'} (±${outlier.tolerance_pct}%)`}
    >
      {sign}
      {outlier.deviation_pct.toFixed(1)}% vs {outlier.basis_year ?? '–'}
    </span>
  )
}

/** One listing row used on the price check page and the suspicious prices tab. */
export function ListingRow({
  listing,
  currency,
  onChanged,
  showWsCode = false,
}: {
  listing: PriceListing
  currency: string
  onChanged: () => void
  showWsCode?: boolean
}) {
  return (
    <tr className={cn('align-top', listing.outlier?.is_outlier && 'bg-red-50', listing.excluded && 'opacity-60')}>
      {showWsCode && <td className="px-3 py-2 text-sm font-medium text-gray-900">{listing.ws_code}</td>}
      <td className="px-3 py-2 text-sm">
        <div className="font-semibold text-gray-900">{formatMoney(listing.price, listing.currency)}</div>
        <div className="text-xs text-gray-500">≈ {formatMoney(listing.converted, currency)}</div>
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">
        {listing.condition || '–'} · {listing.month ? `${String(listing.month).padStart(2, '0')}/` : ''}
        {listing.year ?? '–'}
        <div>
          <OutlierBadge outlier={listing.outlier} />
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">{formatDate(listing.created_at)}</td>
      <td className="px-3 py-2 text-sm text-gray-700">
        {listing.dealer_phone || listing.dealer_name || '–'}
        {listing.country_code && <div className="text-xs text-gray-500">{listing.country_code}</div>}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 max-w-xs whitespace-pre-wrap break-words">
        {listing.source_text || '–'}
        {listing.not_counted_reason && (
          <div className="mt-1 text-gray-400">Not counted: {listing.not_counted_reason}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <ListingActions listing={listing} onChanged={onChanged} />
      </td>
    </tr>
  )
}

export function ListingTable({
  listings,
  currency,
  onChanged,
  showWsCode = false,
}: {
  listings: PriceListing[]
  currency: string
  onChanged: () => void
  showWsCode?: boolean
}) {
  if (!listings.length) return <p className="px-4 py-3 text-sm text-gray-500">No listings</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-medium text-gray-500">
            {showWsCode && <th className="px-3 py-2">WS code</th>}
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Condition · year</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Dealer</th>
            <th className="px-3 py-2">Original text</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} currency={currency} onChanged={onChanged} showWsCode={showWsCode} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Debounced catalog search returning WS codes (approval page "search other watch"). */
export function WatchSearch({
  onPick,
  placeholder = 'Search WS code, reference or model',
  endpoint = '/approval/watch-search',
}: {
  onPick: (w: WatchSummary) => void
  placeholder?: string
  endpoint?: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<WatchSummary[]>([])
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      api
        .get(endpoint, { params: { q } })
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [q, endpoint])
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border rounded-lg shadow-lg">
          {results.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                onPick(w)
                setQ('')
                setResults([])
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              {w.image && <img src={w.image} alt="" className="w-8 h-8 rounded object-cover" />}
              <span className="font-medium text-gray-900">{w.ws_code}</span>
              <span className="text-gray-500 truncate">
                {w.brand} · {w.model}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
