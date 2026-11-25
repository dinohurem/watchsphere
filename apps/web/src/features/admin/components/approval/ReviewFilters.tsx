import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export interface ReviewFilterValues {
  brand: string
  group: string
  reason: string
}

export const NO_FILTERS: ReviewFilterValues = { brand: '', group: '', reason: '' }

interface Options {
  brands: string[]
  groups: string[]
  reasons: { reason: string; count: number }[]
}

/** Brand / chat group / reason filters of the AI decisions and Unsure tabs. */
export function ReviewFilters({
  tab,
  value,
  onChange,
}: {
  tab: 'ai' | 'unsure'
  value: ReviewFilterValues
  onChange: (v: ReviewFilterValues) => void
}) {
  const [options, setOptions] = useState<Options>({ brands: [], groups: [], reasons: [] })
  const [reason, setReason] = useState(value.reason)

  useEffect(() => {
    api
      .get('/approval/filter-options', { params: { tab } })
      .then((res) => setOptions(res.data))
      .catch((error) => console.error('Failed to load filter options:', error))
  }, [tab])

  useEffect(() => setReason(value.reason), [value.reason])

  const select = 'px-2 py-1 border rounded text-sm bg-white max-w-[14rem]'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={value.brand} onChange={(e) => onChange({ ...value, brand: e.target.value })} className={select}>
        <option value="">All brands</option>
        {options.brands.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </select>
      <select value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value })} className={select}>
        <option value="">All chat groups</option>
        {options.groups.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      <input
        list={`reasons-${tab}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => reason !== value.reason && onChange({ ...value, reason })}
        onKeyDown={(e) => e.key === 'Enter' && onChange({ ...value, reason })}
        placeholder="Reason contains…"
        className="px-2 py-1 border rounded text-sm w-56"
      />
      <datalist id={`reasons-${tab}`}>
        {options.reasons.map((r) => (
          <option key={r.reason} value={r.reason}>
            {r.count}×
          </option>
        ))}
      </datalist>
      {(value.brand || value.group || value.reason) && (
        <button onClick={() => onChange(NO_FILTERS)} className="text-xs text-gray-500 hover:underline">
          Clear filters
        </button>
      )}
    </div>
  )
}
