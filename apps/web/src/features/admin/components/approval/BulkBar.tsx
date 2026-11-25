import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { WatchSearch } from '../pricecheck/shared'

/** Row selection that can cover every row matching the filters, not only the visible page. */
export function useSelection(pageIds: string[], resetKey: string) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [allMatching, setAllMatching] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const clear = useCallback(() => {
    setPicked(new Set())
    setAllMatching(false)
    setExcluded(new Set())
  }, [])

  useEffect(clear, [resetKey, clear])

  const isSelected = (id: string) => (allMatching ? !excluded.has(id) : picked.has(id))
  const toggle = (id: string) => {
    const flip = (prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }
    if (allMatching) setExcluded(flip)
    else setPicked(flip)
  }
  const pageAll = pageIds.length > 0 && pageIds.every(isSelected)
  const togglePage = () => {
    if (allMatching) {
      setExcluded(pageAll ? new Set(pageIds) : new Set())
    } else {
      setPicked(pageAll ? new Set() : new Set(pageIds))
    }
  }
  return {
    isSelected,
    toggle,
    pageAll,
    togglePage,
    allMatching,
    selectAllMatching: () => {
      setAllMatching(true)
      setExcluded(new Set())
    },
    clear,
    picked: Array.from(picked),
    excluded: Array.from(excluded),
    hasAny: allMatching || picked.size > 0,
    pickedCount: picked.size,
    excludedCount: excluded.size,
  }
}

export type Selection = ReturnType<typeof useSelection>

interface BulkAction {
  key: string
  label: string
  tone?: 'primary' | 'danger'
  /** Opens a catalogue search; the chosen WS code is sent with the action. */
  pickWatch?: boolean
}

export const AI_ACTIONS: BulkAction[] = [
  { key: 'confirm', label: 'Confirm', tone: 'primary' },
  { key: 'correct', label: 'Correct to…', pickWatch: true },
  { key: 'not_in_catalog', label: 'Not in catalog' },
  { key: 'discard', label: 'Discard', tone: 'danger' },
]

export const UNSURE_ACTIONS: BulkAction[] = [
  { key: 'confirm', label: 'Accept suggested', tone: 'primary' },
  { key: 'pick', label: 'Pick watch…', pickWatch: true },
  { key: 'not_in_catalog', label: 'Not in catalog' },
  { key: 'discard', label: 'Discard', tone: 'danger' },
]

/** Toolbar above a list: select page / all matching, then one action for the whole selection. */
export function BulkBar({
  selection,
  actions,
  noun,
  pageSize,
  total,
  busy,
  progress,
  onAction,
}: {
  selection: Selection
  actions: BulkAction[]
  noun: string
  pageSize: number
  total: number
  busy: boolean
  progress: string
  onAction: (action: string, wsCode?: string) => void
}) {
  const [searching, setSearching] = useState<string | null>(null)
  const count = selection.allMatching ? Math.max(0, total - selection.excludedCount) : selection.pickedCount
  const label = useMemo(
    () => (selection.allMatching ? `All ${count.toLocaleString('en-US')} ${noun} matching the filters` : `${count} selected`),
    [selection.allMatching, count, noun]
  )
  const showAllLink = !selection.allMatching && selection.pageAll && total > pageSize

  const run = (a: BulkAction, wsCode?: string) => {
    if (!confirm(`${a.label}${wsCode ? ` ${wsCode}` : ''}: ${count.toLocaleString('en-US')} ${noun}?`)) return
    setSearching(null)
    onAction(a.key, wsCode)
  }

  return (
    <div className="border-b bg-gray-50 px-4 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={selection.pageAll} onChange={selection.togglePage} />
          Select page
        </label>
        <span className="text-sm text-gray-600">{selection.hasAny ? label : `${total.toLocaleString('en-US')} ${noun}`}</span>
        {showAllLink && (
          <button onClick={selection.selectAllMatching} className="text-sm text-blue-600 hover:underline">
            Select all {total.toLocaleString('en-US')} {noun} matching the filters
          </button>
        )}
        {selection.hasAny && (
          <button onClick={selection.clear} className="text-sm text-gray-500 hover:underline">
            Clear selection
          </button>
        )}
        {progress && <span className="text-xs text-gray-500">{progress}</span>}
      </div>
      {selection.hasAny && count > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          {actions.map((a) =>
            a.pickWatch ? (
              <button
                key={a.key}
                disabled={busy}
                onClick={() => setSearching(searching === a.key ? null : a.key)}
                className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
              >
                {a.label}
              </button>
            ) : (
              <button
                key={a.key}
                disabled={busy}
                onClick={() => run(a)}
                className={
                  a.tone === 'primary'
                    ? 'inline-flex items-center gap-1 px-3 py-1 text-xs bg-primary text-white rounded hover:opacity-90 disabled:opacity-40'
                    : a.tone === 'danger'
                      ? 'px-3 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-40'
                      : 'px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40'
                }
              >
                {a.tone === 'primary' && <Check className="w-3 h-3" />}
                {a.label}
              </button>
            )
          )}
          {searching && (
            <div className="w-72">
              <WatchSearch
                placeholder="Search the watch to assign"
                onPick={(w) =>
                  run(
                    actions.find((x) => x.key === searching)!,
                    w.ws_code
                  )
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
