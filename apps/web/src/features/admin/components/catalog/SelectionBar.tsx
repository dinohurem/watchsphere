import { Download, Trash2 } from 'lucide-react'
import { SelectionMode } from './catalogApi'

export type BulkAction =
  | { action: 'set_status'; value: 'active' | 'draft' }
  | { action: 'set_discontinued'; value: boolean }
  | { action: 'delete' }

interface SelectionBarProps {
  mode: SelectionMode
  selectedCount: number
  pageCount: number
  pageFullySelected: boolean
  filteredTotal: number
  allTotal: number
  hasFilters: boolean
  busy: boolean
  onSelectFiltered: () => void
  onSelectAll: () => void
  onClear: () => void
  onAction: (action: BulkAction) => void
  onExport: (format: 'jsonl' | 'csv') => void
}

const btn = 'px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white hover:bg-gray-50 disabled:opacity-50'

/** Shown above the table while watches are selected: scope switch + bulk actions. */
export function SelectionBar(props: SelectionBarProps) {
  const {
    mode, selectedCount, pageFullySelected, filteredTotal, allTotal, hasFilters, busy,
    onSelectFiltered, onSelectAll, onClear, onAction, onExport,
  } = props

  const label =
    mode === 'all'
      ? `All ${allTotal} watches selected`
      : mode === 'filtered'
        ? `All ${filteredTotal} filtered watches selected`
        : `${selectedCount} selected`

  return (
    <div className="px-4 py-2.5 border-b bg-gray-50 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="font-medium text-gray-900">{label}</span>
      {mode === 'ids' && pageFullySelected && hasFilters && filteredTotal > selectedCount && (
        <button onClick={onSelectFiltered} className="text-primary underline text-xs">
          Select all {filteredTotal} filtered
        </button>
      )}
      {mode !== 'all' && allTotal > selectedCount && (
        <button onClick={onSelectAll} className="text-primary underline text-xs">
          Select all {allTotal} watches
        </button>
      )}
      <button onClick={onClear} className="text-gray-500 underline text-xs">
        Clear
      </button>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <button disabled={busy} className={btn} onClick={() => onAction({ action: 'set_status', value: 'active' })}>
          Set active
        </button>
        <button disabled={busy} className={btn} onClick={() => onAction({ action: 'set_status', value: 'draft' })}>
          Set draft
        </button>
        <button disabled={busy} className={btn} onClick={() => onAction({ action: 'set_discontinued', value: true })}>
          Set discontinued
        </button>
        <button disabled={busy} className={btn} onClick={() => onAction({ action: 'set_discontinued', value: false })}>
          Not discontinued
        </button>
        <button disabled={busy} className={`${btn} flex items-center gap-1`} onClick={() => onExport('jsonl')}>
          <Download size={12} /> JSONL
        </button>
        <button disabled={busy} className={`${btn} flex items-center gap-1`} onClick={() => onExport('csv')}>
          <Download size={12} /> CSV
        </button>
        <button
          disabled={busy}
          className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-xs bg-white hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
          onClick={() => onAction({ action: 'delete' })}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
