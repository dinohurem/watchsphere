import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { FALLBACK_LIST_PRICE_COUNTRIES, ListPriceCountry } from './catalogApi'

let cachedCountries: ListPriceCountry[] | null = null

export function useListPriceCountries(): ListPriceCountry[] {
  const [countries, setCountries] = useState<ListPriceCountry[]>(
    cachedCountries ?? FALLBACK_LIST_PRICE_COUNTRIES
  )
  useEffect(() => {
    if (cachedCountries) return
    api
      .get('/catalog-admin/list-price-countries')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length) {
          cachedCountries = res.data
          setCountries(res.data)
        }
      })
      .catch(() => {})
  }, [])
  return countries
}

interface ListPriceFieldsProps {
  /** Country code → price as typed (string so partial input like "69." survives). */
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  discontinued: boolean
  onDiscontinuedChange: (value: boolean) => void
}

/** The 13 list-price inputs: currency and tax are fixed per country, only the price is typed. */
export function ListPriceFields({ value, onChange, discontinued, onDiscontinuedChange }: ListPriceFieldsProps) {
  const countries = useListPriceCountries()
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">List prices</label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={discontinued}
            onChange={(e) => onDiscontinuedChange(e.target.checked)}
            className="h-4 w-4 text-primary border-gray-300 rounded"
          />
          Discontinued
        </label>
      </div>
      {discontinued && (
        <p className="text-xs text-gray-500 mb-2">The app shows “Discontinued” for every country.</p>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 ${discontinued ? 'opacity-60' : ''}`}>
        {countries.map((c) => (
          <div key={c.code} className="flex items-center gap-2">
            <div className="w-32 shrink-0">
              <div className="text-sm text-gray-700 leading-tight">{c.name}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{c.tax_label}</div>
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={value[c.code] ?? ''}
                onChange={(e) => onChange({ ...value, [c.code]: e.target.value })}
                className="w-full pl-3 pr-12 py-1.5 border rounded-lg text-sm"
                placeholder="No data"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {c.currency}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Form strings → API payload (empty inputs dropped, separators stripped). */
export function listPricesToPayload(value: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [code, raw] of Object.entries(value)) {
    const cleaned = (raw || '').replace(/[\s',]/g, '')
    if (!cleaned) continue
    const n = Number(cleaned)
    if (Number.isFinite(n) && n > 0) out[code] = n
  }
  return out
}

export function listPricesToForm(value: Record<string, number> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [code, price] of Object.entries(value || {})) out[code] = String(price)
  return out
}
