import { CatalogFilters } from './catalogApi'

interface CatalogFilterBarProps {
  filters: CatalogFilters
  brands: string[]
  onChange: (filters: CatalogFilters) => void
}

const FLAGS: { key: keyof CatalogFilters; label: string }[] = [
  { key: 'no_image', label: 'No image' },
  { key: 'no_ws_code', label: 'No WS code' },
  { key: 'no_aliases', label: 'No aliases' },
  { key: 'no_list_price', label: 'No list price' },
]

/** Brand + "missing data" filters for the admin watch list (status and search live in the page). */
export function CatalogFilterBar({ filters, brands, onChange }: CatalogFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.brand || ''}
        onChange={(e) => onChange({ ...filters, brand: e.target.value || undefined })}
        className="px-3 py-2 border rounded-lg text-sm"
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      {FLAGS.map(({ key, label }) => {
        const active = Boolean(filters[key])
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...filters, [key]: !active })}
            className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
              active ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
