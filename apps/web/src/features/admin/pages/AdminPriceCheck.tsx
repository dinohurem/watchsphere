import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/services/api'
import {
  CURRENCIES,
  ListingTable,
  PriceListing,
  WatchSearch,
  WatchSummary,
  formatMoney,
} from '../components/pricecheck/shared'

interface Side {
  median: number | null
  count: number
  listings: PriceListing[]
}

interface PriceCheckData {
  ws_code: string
  watch: WatchSummary | null
  period: string
  currency: string
  fresh: Side
  used: Side
  not_counted: PriceListing[]
}

const PERIODS = ['1W', '1M', '3M', '1Y', 'ALL']

export function AdminPriceCheck() {
  const [params, setParams] = useSearchParams()
  const wsCode = params.get('ws') || ''
  const [period, setPeriod] = useState('1M')
  const [currency, setCurrency] = useState('EUR')
  const [data, setData] = useState<PriceCheckData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!wsCode) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/price-check/watch/${encodeURIComponent(wsCode)}`, {
        params: { period, currency },
      })
      setData(res.data)
    } catch (error) {
      console.error('Failed to load price check:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [wsCode, period, currency])

  useEffect(() => {
    load()
  }, [load])

  const renderSide = (title: string, side: Side) => (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          {title} <span className="font-normal text-gray-500">({side.count})</span>
        </h2>
        <span className="text-sm text-gray-700">
          Median: <strong>{side.median !== null ? formatMoney(side.median, currency) : 'Not enough data'}</strong>
        </span>
      </div>
      <ListingTable listings={side.listings} currency={currency} onChanged={load} />
    </div>
  )

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price check</h1>
          <p className="text-sm text-gray-500">
            Listings in the median of a WS code. Outliers are compared with the same condition and year
            (±25 %, else the nearest year ±35 %).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-72">
            <WatchSearch endpoint="/price-check/search" onPick={(w) => setParams({ ws: w.ws_code })} />
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-2 py-2 border rounded-lg text-sm">
            {PERIODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-2 py-2 border rounded-lg text-sm">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {!wsCode && <p className="text-sm text-gray-500">Search a WS code to start.</p>}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="flex items-center gap-3 mb-4">
            {data.watch?.image && <img src={data.watch.image} alt="" className="w-12 h-12 rounded object-cover" />}
            <div>
              <div className="text-lg font-semibold text-gray-900">{data.ws_code}</div>
              {data.watch && (
                <div className="text-sm text-gray-500">
                  {data.watch.brand} · {data.watch.model}
                </div>
              )}
            </div>
          </div>
          {renderSide('Fresh', data.fresh)}
          {renderSide('Used', data.used)}
          {data.not_counted.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold text-gray-800">
                  Not counted <span className="font-normal text-gray-500">({data.not_counted.length})</span>
                </h2>
              </div>
              <ListingTable listings={data.not_counted} currency={currency} onChanged={load} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
