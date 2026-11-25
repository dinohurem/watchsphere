import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, RotateCcw, Search, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'
import { CURRENCIES, formatDate, formatMoney } from '../pricecheck/shared'
import { useSelection } from './BulkBar'
import { DownloadCsvButton } from './csvDownload'

type Cause = 'wrong_currency' | 'price_from_other_line' | 'typo' | 'real_outlier'

interface HeldOffer {
  id: string
  ws_code: string
  brand: string | null
  model: string | null
  price: number | null
  currency: string | null
  converted: number | null
  median: number | null
  offer_count: number | null
  deviation_pct: number | null
  basis_year: number | null
  tolerance_pct: number | null
  cause: Cause
  suggested_currency: string | null
  suggested_price: number | null
  peers_currency: string | null
  other_line_ws_code: string | null
  condition: string | null
  year: number | null
  month: number | null
  created_at: string
  dealer_phone: string | null
  source_group: string | null
  source_text: string | null
}

interface ScanResult {
  dry_run: boolean
  active_orders: number
  flagged: number
  flagged_share: number
  by_cause: Record<Cause, number>
  held: number
}

const PAGE_SIZE = 100

const CAUSE_LABEL: Record<Cause, string> = {
  wrong_currency: 'Wrong currency',
  price_from_other_line: 'Price from another line',
  typo: 'Typo',
  real_outlier: 'Real outlier',
}

const CAUSE_STYLE: Record<Cause, string> = {
  wrong_currency: 'bg-amber-100 text-amber-800',
  price_from_other_line: 'bg-purple-100 text-purple-800',
  typo: 'bg-blue-100 text-blue-800',
  real_outlier: 'bg-gray-100 text-gray-700',
}

const SORTS = [
  { key: 'cheap_first', label: 'Too cheap first' },
  { key: 'expensive_first', label: 'Too expensive first' },
  { key: 'newest', label: 'Newest first' },
  { key: 'ws_code', label: 'WS code' },
]

function errorText(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Request failed'
}

function CauseBadge({ o }: { o: HeldOffer }) {
  return (
    <div className="space-y-1">
      <span className={cn('inline-block px-2 py-0.5 text-xs rounded', CAUSE_STYLE[o.cause])}>{CAUSE_LABEL[o.cause]}</span>
      {o.cause === 'wrong_currency' && o.suggested_currency && <div className="text-xs text-gray-600">Probably {o.suggested_currency}</div>}
      {o.cause === 'wrong_currency' && !o.suggested_currency && o.peers_currency && (
        <div className="text-xs text-gray-600">
          This offer fits; the other offers look like {o.peers_currency}. Check them, nothing to fix here.
        </div>
      )}
      {o.cause === 'typo' && o.suggested_price && (
        <div className="text-xs text-gray-600">Probably {formatMoney(o.suggested_price, o.currency)}</div>
      )}
      {o.cause === 'price_from_other_line' && o.other_line_ws_code && (
        <div className="text-xs text-gray-600">Same price as {o.other_line_ws_code}</div>
      )}
    </div>
  )
}

function RowActions({ o, busy, onDecide }: { o: HeldOffer; busy: boolean; onDecide: (d: string, v?: string) => void }) {
  const [currency, setCurrency] = useState(o.suggested_currency || o.currency || 'USD')
  const [price, setPrice] = useState(o.suggested_price ? String(o.suggested_price) : '')
  const [open, setOpen] = useState<'' | 'currency' | 'price'>('')
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <button
          disabled={busy}
          onClick={() => onDecide('approve')}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-white rounded hover:opacity-90 disabled:opacity-40"
        >
          <Check className="w-3 h-3" /> Approve
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (confirm('Reject this offer? It is removed (you can undo it afterwards).')) onDecide('reject')
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 className="w-3 h-3" /> Reject
        </button>
        <button
          onClick={() => setOpen(open === 'currency' ? '' : 'currency')}
          className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
        >
          Fix currency
        </button>
        <button onClick={() => setOpen(open === 'price' ? '' : 'price')} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
          Correct price
        </button>
      </div>
      {open === 'currency' && (
        <div className="flex items-center gap-1">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-1 py-1 border rounded text-sm">
            {[...CURRENCIES, 'USDT'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button disabled={busy} onClick={() => onDecide('fix_currency', currency)} className="p-1.5 rounded hover:bg-gray-100">
            <Check className="w-4 h-4 text-green-700" />
          </button>
        </div>
      )}
      {open === 'price' && (
        <div className="flex items-center gap-1">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={o.currency || ''}
            className="w-28 px-2 py-1 border rounded text-sm"
            inputMode="decimal"
          />
          <button disabled={busy || !price} onClick={() => onDecide('correct_price', price)} className="p-1.5 rounded hover:bg-gray-100">
            <Check className="w-4 h-4 text-green-700" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Tab "Suspicious prices": offers held back at creation, with decisions one by one, in bulk and by file. */
export function SuspiciousPrices({ onChanged, onUndone }: { onChanged: () => void; onUndone: () => void }) {
  const [items, setItems] = useState<HeldOffer[]>([])
  const [total, setTotal] = useState(0)
  const [causes, setCauses] = useState<Record<string, number>>({})
  const [brands, setBrands] = useState<string[]>([])
  const [cause, setCause] = useState('')
  const [brand, setBrand] = useState('')
  const [wsCode, setWsCode] = useState('')
  const [direction, setDirection] = useState('')
  const [sort, setSort] = useState('cheap_first')
  const [currency, setCurrency] = useState('EUR')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [lastBatch, setLastBatch] = useState<string | null>(null)
  const [bulkCurrency, setBulkCurrency] = useState('HKD')
  const [bulkPrice, setBulkPrice] = useState('')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const filterKey = JSON.stringify([cause, brand, wsCode, direction, sort, page])
  const selection = useSelection(
    items.map((i) => i.id),
    filterKey
  )
  const filters = { cause: cause || null, brand: brand || null, ws_code: wsCode || null, direction: direction || null }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/approval/suspicious-prices', {
        params: { currency, cause, brand, ws_code: wsCode, direction, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      })
      setItems(res.data.items)
      setTotal(res.data.total)
      const opts = await api.get('/approval/suspicious-prices/filter-options')
      setCauses(opts.data.causes)
      setBrands(opts.data.brands)
    } catch (error) {
      console.error('Failed to load suspicious prices:', error)
    } finally {
      setLoading(false)
    }
  }, [currency, cause, brand, wsCode, direction, sort, page])

  useEffect(() => {
    load()
  }, [load])

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      setPage(0)
      set(v)
    }

  /** One decision for ids or everything matching the filters; continues server-side chunks. */
  const decide = async (decision: string, value: string | undefined, ids?: string[]) => {
    const all = !ids
    const body = {
      decision,
      value,
      ...(all ? { all_matching: selection.allMatching, filters, exclude_ids: selection.excluded, ids: selection.picked } : { ids }),
    }
    setBusy(true)
    setMessage('')
    let decided = 0
    let failed = 0
    const reasons = new Set<string>()
    let after: string | null = null
    let batch: string | null = null
    try {
      for (;;) {
        const res: {
          data: {
            decided: number
            failed_count: number
            failed: Record<string, string>
            remaining: number
            next_after: string | null
            batch_id: string | null
          }
        } = await api.post('/approval/suspicious-prices/decide', { ...body, after_id: after }, { timeout: 0 })
        decided += res.data.decided
        failed += res.data.failed_count
        Object.values(res.data.failed).forEach((r) => reasons.add(r))
        batch = res.data.batch_id || batch
        if (!res.data.remaining || !res.data.next_after) break
        after = res.data.next_after
      }
      setLastBatch(batch)
      setMessage(
        `${decided.toLocaleString('en-US')} offer(s) decided` +
          (failed ? `, ${failed} could not be (${Array.from(reasons).join('; ')}) and stay in the queue` : '')
      )
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
      selection.clear()
      await load()
      onChanged()
    }
  }

  const undo = async () => {
    if (!lastBatch || !confirm('Undo the last decision? The offers go back to the queue as they were.')) return
    setBusy(true)
    try {
      await api.post(`/approval/file/${lastBatch}/undo`, undefined, { timeout: 0 })
      setMessage('Undone.')
      setLastBatch(null)
      await load()
      onChanged()
      onUndone()
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  const runScan = async (dryRun: boolean) => {
    setScanning(true)
    try {
      const res = await api.post('/approval/suspicious-prices/scan-existing', undefined, { params: { dry_run: dryRun }, timeout: 0 })
      setScan(res.data)
      if (!dryRun) {
        setMessage(`${res.data.held.toLocaleString('en-US')} existing offer(s) held back.`)
        await load()
        onChanged()
      }
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setScanning(false)
    }
  }

  const count = selection.allMatching ? Math.max(0, total - selection.excludedCount) : selection.pickedCount
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const bulk = (decision: string, value: string | undefined, label: string) => {
    if (confirm(`${label}: ${count.toLocaleString('en-US')} offer(s)?`)) decide(decision, value)
  }
  const select = 'px-2 py-1 border rounded text-sm bg-white'

  return (
    <div>
      <div className="px-4 py-3 border-b space-y-3">
        <p className="text-xs text-gray-500">
          Offers held back when they came in: far from the other offers of the same WS code, condition and year. They are not in the app,
          the order book, the lowest price, the medians or the counts until you decide.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cause} onChange={(e) => resetPage(setCause)(e.target.value)} className={select}>
            <option value="">All causes ({Object.values(causes).reduce((a, b) => a + b, 0)})</option>
            {(Object.keys(CAUSE_LABEL) as Cause[]).map((c) => (
              <option key={c} value={c}>
                {CAUSE_LABEL[c]} ({causes[c] ?? 0})
              </option>
            ))}
          </select>
          <select value={brand} onChange={(e) => resetPage(setBrand)(e.target.value)} className={select}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select value={direction} onChange={(e) => resetPage(setDirection)(e.target.value)} className={select}>
            <option value="">Cheap and expensive</option>
            <option value="cheap">Too cheap only</option>
            <option value="expensive">Too expensive only</option>
          </select>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-400" />
            <input
              value={wsCode}
              onChange={(e) => resetPage(setWsCode)(e.target.value)}
              placeholder="WS code"
              className="pl-6 pr-2 py-1 border rounded text-sm w-36"
            />
          </div>
          <select value={sort} onChange={(e) => resetPage(setSort)(e.target.value)} className={select}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={select} title="Display currency">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="ml-auto" />
          <DownloadCsvButton tab="prices" params={{ currency, cause, brand, ws_code: wsCode, direction, sort }} />
          <button
            disabled={scanning}
            onClick={() => runScan(true)}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            title="Check the active offers that exist today"
          >
            {scanning ? 'Checking…' : 'Check existing offers'}
          </button>
        </div>

        {scan && (
          <div className="border rounded-lg p-3 text-sm space-y-2 bg-gray-50">
            {scan.dry_run ? (
              <>
                <div>
                  Dry run: <span className="font-semibold">{scan.flagged.toLocaleString('en-US')}</span> of{' '}
                  {scan.active_orders.toLocaleString('en-US')} active offers ({(scan.flagged_share * 100).toFixed(1)} %) would be held back.
                  Nothing has changed.
                </div>
                <div className="text-xs text-gray-600">
                  {(Object.keys(CAUSE_LABEL) as Cause[]).map((c) => `${CAUSE_LABEL[c]}: ${scan.by_cause[c] ?? 0}`).join(' · ')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={scanning || scan.flagged === 0}
                    onClick={() => {
                      if (confirm(`Hold back ${scan.flagged} existing offers? They leave the app until you decide.`)) runScan(false)
                    }}
                    className="px-3 py-1 text-xs bg-primary text-white rounded disabled:opacity-40"
                  >
                    Hold back {scan.flagged.toLocaleString('en-US')} offers
                  </button>
                  <button onClick={() => setScan(null)} className="text-xs text-gray-500 hover:underline">
                    Close
                  </button>
                </div>
                {scan.flagged_share > 0.1 && (
                  <p className="flex items-center gap-2 text-xs text-amber-700">
                    <AlertTriangle className="w-4 h-4" /> More than 10 % of the active offers - check a few before holding them back.
                  </p>
                )}
              </>
            ) : (
              <div>
                Held back: <span className="font-semibold">{scan.held.toLocaleString('en-US')}</span> offers.{' '}
                <button onClick={() => setScan(null)} className="text-xs text-gray-500 hover:underline">
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        {message && (
          <p className="text-sm text-gray-700">
            {message}{' '}
            {lastBatch && (
              <button
                onClick={undo}
                disabled={busy}
                className="inline-flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            )}
          </p>
        )}
      </div>

      <div className="border-b bg-gray-50 px-4 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={selection.pageAll} onChange={selection.togglePage} />
            Select page
          </label>
          <span className="text-sm text-gray-600">
            {selection.hasAny
              ? selection.allMatching
                ? `All ${count.toLocaleString('en-US')} offers matching the filters`
                : `${count} selected`
              : `${total.toLocaleString('en-US')} offers`}
          </span>
          {!selection.allMatching && selection.pageAll && total > PAGE_SIZE && (
            <button onClick={selection.selectAllMatching} className="text-sm text-blue-600 hover:underline">
              Select all {total.toLocaleString('en-US')} offers matching the filters
            </button>
          )}
          {selection.hasAny && (
            <button onClick={selection.clear} className="text-sm text-gray-500 hover:underline">
              Clear selection
            </button>
          )}
        </div>
        {selection.hasAny && count > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={busy}
              onClick={() => bulk('approve', undefined, 'Approve')}
              className="px-3 py-1 text-xs bg-primary text-white rounded disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => bulk('reject', undefined, 'Reject (remove)')}
              className="px-3 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => bulk('fix_currency', 'suggested', 'Apply the suggested currency')}
              className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
            >
              Apply suggested currency
            </button>
            <button
              disabled={busy}
              onClick={() => bulk('correct_price', 'suggested', 'Apply the suggested price')}
              className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
            >
              Apply suggested price
            </button>
            <span className="flex items-center gap-1">
              <select value={bulkCurrency} onChange={(e) => setBulkCurrency(e.target.value)} className="px-1 py-1 border rounded text-xs">
                {[...CURRENCIES, 'USDT'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button
                disabled={busy}
                onClick={() => bulk('fix_currency', bulkCurrency, `Set the currency to ${bulkCurrency}`)}
                className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
              >
                Set currency
              </button>
            </span>
            <span className="flex items-center gap-1">
              <input
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="Price"
                className="w-24 px-2 py-1 border rounded text-xs"
                inputMode="decimal"
              />
              <button
                disabled={busy || !bulkPrice}
                onClick={() => bulk('correct_price', bulkPrice, `Set the price to ${bulkPrice}`)}
                className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
              >
                Set price
              </button>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : !items.length ? (
        <p className="px-4 py-3 text-sm text-gray-500">Nothing held back</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">WS code</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Compared with</th>
                <th className="px-3 py-2">Cause</th>
                <th className="px-3 py-2">Dealer</th>
                <th className="px-3 py-2">Original text</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((o) => (
                <tr key={o.id} className={cn('align-top', (o.deviation_pct ?? 0) < 0 && 'bg-amber-50/40')}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selection.isSelected(o.id)} onChange={() => selection.toggle(o.id)} />
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{o.ws_code}</div>
                    <div className="text-xs text-gray-500">
                      {o.condition || '–'} · {o.month ? `${String(o.month).padStart(2, '0')}/` : ''}
                      {o.year ?? '–'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div className="font-semibold text-gray-900">{formatMoney(o.price, o.currency)}</div>
                    <div className="text-xs text-gray-500">≈ {formatMoney(o.converted, currency)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div className="text-gray-900">Median {formatMoney(o.median, currency)}</div>
                    <div className="text-xs text-gray-500">
                      {o.offer_count ?? '–'} offers{o.basis_year ? ` · ${o.basis_year}` : ''} (±{o.tolerance_pct}%)
                    </div>
                    <span
                      className={cn(
                        'inline-block mt-1 px-2 py-0.5 text-xs rounded',
                        (o.deviation_pct ?? 0) < 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      )}
                    >
                      {(o.deviation_pct ?? 0) > 0 ? '+' : ''}
                      {o.deviation_pct?.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <CauseBadge o={o} />
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {o.dealer_phone || '–'}
                    <div className="text-xs text-gray-500">{o.source_group}</div>
                    <div className="text-xs text-gray-500">{formatDate(o.created_at)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-xs whitespace-pre-wrap break-words">{o.source_text || '–'}</td>
                  <td className="px-3 py-2">
                    <RowActions o={o} busy={busy} onDecide={(d, v) => decide(d, v, [o.id])} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t text-sm text-gray-600">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-40">
            Previous
          </button>
          Page {page + 1} of {pages.toLocaleString('en-US')}
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
