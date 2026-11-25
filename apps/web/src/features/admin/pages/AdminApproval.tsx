import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, RefreshCw } from 'lucide-react'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'
import { AuthImage, WatchSearch, WatchSummary, formatDate } from '../components/pricecheck/shared'
import { AI_ACTIONS, BulkBar, UNSURE_ACTIONS, useSelection } from '../components/approval/BulkBar'
import { ApprovalFilePanel } from '../components/approval/ApprovalFilePanel'
import { SuspiciousPrices } from '../components/approval/SuspiciousPrices'
import { DownloadCsvButton } from '../components/approval/csvDownload'
import { NO_FILTERS, ReviewFilters, ReviewFilterValues } from '../components/approval/ReviewFilters'

type Tab = 'ai' | 'unsure' | 'aliases' | 'new' | 'discarded' | 'prices'

interface Candidate {
  ws_code: string
  brand?: string
  model?: string
  reference?: string
  score?: number
  reason?: string
  watch?: WatchSummary | null
}

interface Item {
  id: string
  kind: string
  status: string
  mode: string
  group_name: string | null
  source_text: string | null
  image_url: string | null
  sender_phone: string | null
  candidates: Candidate[]
  reason: string | null
  ai_ws_code: string | null
  ai_reason: string | null
  ai_watch: WatchSummary | null
  order_id: string | null
  resolution: string | null
  resolved_ws_code: string | null
  created_at: string
  expires_at: string | null
}

interface UnsureGroup {
  key: string
  item_ids: string[]
  count: number
  source_text: string | null
  image_url: string | null
  candidates: Candidate[]
  reason: string | null
  mode: string
  groups: string[]
  phones: string[]
}

interface AliasSuggestion {
  id: string
  alias: string
  ws_code: string
  watch: WatchSummary | null
  status: string
  count: number
  examples: string[]
}

interface NewWatch {
  reference: string | null
  brand: string | null
  count: number
  dealers: number
  examples: string[]
  item_ids: string[]
  image_url: string | null
  last_seen: string
}

interface Summary {
  ai_decisions: number
  unsure: number
  aliases: number
  new_watches: number
  discarded: number
  suspicious_prices: number
}

const PAGE_SIZE = 100

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 border-t text-sm text-gray-600">
      <button disabled={page === 0} onClick={() => onPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-40">
        Previous
      </button>
      Page {page + 1} of {pages.toLocaleString('en-US')}
      <button disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-40">
        Next
      </button>
    </div>
  )
}

const TABS: { key: Tab; label: string; count?: keyof Summary }[] = [
  { key: 'ai', label: 'AI decisions', count: 'ai_decisions' },
  { key: 'unsure', label: 'Unsure', count: 'unsure' },
  { key: 'aliases', label: 'Alias suggestions', count: 'aliases' },
  { key: 'new', label: 'New watches', count: 'new_watches' },
  { key: 'discarded', label: 'Discarded', count: 'discarded' },
  { key: 'prices', label: 'Suspicious prices', count: 'suspicious_prices' },
]

function SourceText({ text }: { text: string | null }) {
  return (
    <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-sans bg-gray-50 rounded p-2 max-h-40 overflow-auto">
      {text || '–'}
    </pre>
  )
}

function WatchChip({ watch, wsCode }: { watch?: WatchSummary | null; wsCode?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {watch?.image && <img src={watch.image} alt="" className="w-10 h-10 rounded object-cover" />}
      <div>
        <div className="text-sm font-semibold text-gray-900">{watch?.ws_code || wsCode || '–'}</div>
        {watch && (
          <div className="text-xs text-gray-500">
            {watch.brand} · {watch.model}
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminApproval() {
  const [tab, setTab] = useState<Tab>('ai')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiItems, setAiItems] = useState<Item[]>([])
  const [unsure, setUnsure] = useState<UnsureGroup[]>([])
  const [aliases, setAliases] = useState<AliasSuggestion[]>([])
  const [selectedAliases, setSelectedAliases] = useState<string[]>([])
  const [newWatches, setNewWatches] = useState<NewWatch[]>([])
  const [discarded, setDiscarded] = useState<Item[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [searching, setSearching] = useState<string | null>(null)
  const [aiFilters, setAiFilters] = useState<ReviewFilterValues>(NO_FILTERS)
  const [unsureFilters, setUnsureFilters] = useState<ReviewFilterValues>(NO_FILTERS)
  const [aiPage, setAiPage] = useState(0)
  const [unsurePage, setUnsurePage] = useState(0)
  const [aiTotal, setAiTotal] = useState(0)
  const [unsureTotal, setUnsureTotal] = useState(0)
  const [unsureItemTotal, setUnsureItemTotal] = useState(0)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const aiKey = JSON.stringify([aiFilters, aiPage])
  const unsureKey = JSON.stringify([unsureFilters, unsurePage])
  const aiSel = useSelection(
    aiItems.map((i) => i.id),
    aiKey
  )
  const unsureSel = useSelection(
    unsure.map((g) => g.key),
    unsureKey
  )

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/approval/summary')
      setSummary(res.data)
    } catch (error) {
      console.error('Failed to load approval summary:', error)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'ai') {
        const res = await api.get('/approval/ai-decisions', {
          params: { ...aiFilters, limit: PAGE_SIZE, offset: aiPage * PAGE_SIZE },
        })
        setAiItems(res.data.items)
        setAiTotal(res.data.total)
      }
      if (tab === 'unsure') {
        const res = await api.get('/approval/unsure', {
          params: { ...unsureFilters, limit: PAGE_SIZE, offset: unsurePage * PAGE_SIZE },
        })
        setUnsure(res.data.groups)
        setUnsureTotal(res.data.total)
        setUnsureItemTotal(res.data.item_total)
      }
      if (tab === 'aliases') {
        setAliases((await api.get('/approval/aliases')).data)
        setSelectedAliases([])
      }
      if (tab === 'new') setNewWatches((await api.get('/approval/new-watches')).data)
      if (tab === 'discarded') setDiscarded((await api.get('/approval/discarded')).data.items)
    } catch (error) {
      console.error('Failed to load approval tab:', error)
    } finally {
      setLoading(false)
    }
  }, [tab, aiFilters, aiPage, unsureFilters, unsurePage])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const refresh = () => {
    load()
    loadSummary()
  }

  const act = async (fn: () => Promise<unknown>) => {
    try {
      const res = (await fn()) as { data?: { failed?: Record<string, string> } } | undefined
      const failed = Object.values(res?.data?.failed ?? {})
      if (failed.length) {
        // Items that could not become a listing stay in the queue with this reason.
        alert(`${failed.length} item(s) not imported:\n${Array.from(new Set(failed)).join('\n')}`)
      }
      refresh()
    } catch (error) {
      console.error(error)
      alert('Action failed')
    }
  }

  const aiAction = (id: string, action: string, ws_code?: string) =>
    act(() => api.post(`/approval/ai-decisions/${id}`, { action, ws_code }))

  const unsureDecide = (ids: string[], action: string, ws_code?: string) =>
    act(() => api.post('/approval/unsure/decide', { item_ids: ids, action, ws_code }))

  /** One server-side decision for the whole selection; repeats from where it stopped for big ones. */
  const bulkRun = async (kind: 'ai' | 'unsure', action: string, ws_code?: string) => {
    const sel = kind === 'ai' ? aiSel : unsureSel
    const filters = kind === 'ai' ? aiFilters : unsureFilters
    const base = {
      tab: kind,
      action,
      ws_code,
      all_matching: sel.allMatching,
      filters: {
        brand: filters.brand || null,
        group: filters.group || null,
        reason: filters.reason || null,
      },
      ...(kind === 'ai' ? { ids: sel.picked, exclude_ids: sel.excluded } : { keys: sel.picked, exclude_keys: sel.excluded }),
    }
    setBulkBusy(true)
    let decided = 0
    let failedCount = 0
    const reasons = new Set<string>()
    let after: string | null = null
    try {
      for (;;) {
        const res: {
          data: {
            decided: number
            failed_count: number
            failed: Record<string, string>
            remaining: number
            next_after: string | null
          }
        } = await api.post('/approval/bulk/decide', { ...base, after_id: after }, { timeout: 0 })
        decided += res.data.decided
        failedCount += res.data.failed_count
        Object.values(res.data.failed).forEach((r) => reasons.add(r))
        setBulkProgress(`${decided.toLocaleString('en-US')} decided${res.data.remaining ? ', continuing…' : ''}`)
        if (!res.data.remaining || !res.data.next_after) break
        after = res.data.next_after
      }
      if (failedCount) {
        alert(`${failedCount} item(s) could not be decided and stay in the queue:\n${Array.from(reasons).join('\n')}`)
      }
    } catch (error) {
      console.error(error)
      alert('Bulk action failed')
    } finally {
      setBulkBusy(false)
      setBulkProgress('')
      sel.clear()
      refresh()
    }
  }

  const aliasDecide = (action: string, ws_code?: string) =>
    act(() => api.post('/approval/aliases/decide', { ids: selectedAliases, action, ws_code }))

  const renderAi = () => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <ReviewFilters
          tab="ai"
          value={aiFilters}
          onChange={(v) => {
            setAiPage(0)
            setAiFilters(v)
          }}
        />
        <DownloadCsvButton tab="ai" params={{ ...aiFilters }} />
      </div>
      <BulkBar
        selection={aiSel}
        actions={AI_ACTIONS}
        noun="AI decisions"
        pageSize={PAGE_SIZE}
        total={aiTotal}
        busy={bulkBusy}
        progress={bulkProgress}
        onAction={(a, ws) => bulkRun('ai', a, ws)}
      />
      <div className="divide-y divide-gray-200">
        {aiItems.map((item) => (
          <div key={item.id} className="p-4 flex flex-col lg:flex-row gap-4">
            <input type="checkbox" className="mt-1 shrink-0" checked={aiSel.isSelected(item.id)} onChange={() => aiSel.toggle(item.id)} />
            <AuthImage src={item.image_url} className="w-24 h-24 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">
                {item.mode} · {item.group_name} · {item.sender_phone} · {formatDate(item.created_at)}
              </div>
              <SourceText text={item.source_text} />
            </div>
            <div className="lg:w-80 shrink-0 space-y-2">
              <WatchChip watch={item.ai_watch} wsCode={item.ai_ws_code} />
              <p className="text-xs text-gray-600">{item.ai_reason}</p>
              {correcting === item.id ? (
                <div className="space-y-2">
                  <WatchSearch
                    onPick={(w) => {
                      setCorrecting(null)
                      aiAction(item.id, 'correct', w.ws_code)
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => aiAction(item.id, 'not_in_catalog')}
                      className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                    >
                      Not in catalog
                    </button>
                    <button
                      onClick={() => aiAction(item.id, 'discard')}
                      className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                    >
                      Discard
                    </button>
                    <button onClick={() => setCorrecting(null)} className="px-2 py-1 text-xs text-gray-500">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => aiAction(item.id, 'confirm')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded hover:opacity-90"
                  >
                    <Check className="w-3 h-3" /> Confirm
                  </button>
                  <button onClick={() => setCorrecting(item.id)} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">
                    Correct
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!aiItems.length && <p className="p-4 text-sm text-gray-500">Nothing to check</p>}
      </div>
      <Pager page={aiPage} total={aiTotal} onPage={setAiPage} />
    </div>
  )

  const renderUnsure = () => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <ReviewFilters
          tab="unsure"
          value={unsureFilters}
          onChange={(v) => {
            setUnsurePage(0)
            setUnsureFilters(v)
          }}
        />
        <DownloadCsvButton tab="unsure" params={{ ...unsureFilters }} />
      </div>
      <BulkBar
        selection={unsureSel}
        actions={UNSURE_ACTIONS}
        noun="texts"
        pageSize={PAGE_SIZE}
        total={unsureTotal}
        busy={bulkBusy}
        progress={bulkProgress}
        onAction={(a, ws) => bulkRun('unsure', a, ws)}
      />
      <p className="px-4 py-1.5 text-xs text-gray-500 border-b">
        Identical texts are grouped: one decision applies to every message in the group. {unsureItemTotal.toLocaleString('en-US')} messages
        in {unsureTotal.toLocaleString('en-US')} groups.
      </p>
      <div className="divide-y divide-gray-200">
        {unsure.map((g) => (
          <div key={g.key} className="p-4 flex flex-col lg:flex-row gap-4">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={unsureSel.isSelected(g.key)}
              onChange={() => unsureSel.toggle(g.key)}
            />
            <AuthImage src={g.image_url} className="w-24 h-24 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">
                {g.mode} · {g.groups.join(', ')} · {g.phones.slice(0, 3).join(', ')}
                {g.count > 1 && <span className="ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-700">{g.count}× same text</span>}
              </div>
              <SourceText text={g.source_text} />
              {g.reason && <p className="text-xs text-gray-500 mt-1">{g.reason}</p>}
            </div>
            <div className="lg:w-96 shrink-0 space-y-2">
              {g.candidates.map((c) => (
                <div key={c.ws_code} className="flex items-center justify-between gap-2 border rounded p-2">
                  <WatchChip watch={c.watch} wsCode={c.ws_code} />
                  <button
                    onClick={() => unsureDecide(g.item_ids, 'pick', c.ws_code)}
                    className="px-3 py-1 text-xs bg-primary text-white rounded hover:opacity-90"
                  >
                    Pick
                  </button>
                </div>
              ))}
              {searching === g.key ? (
                <WatchSearch
                  onPick={(w) => {
                    setSearching(null)
                    unsureDecide(g.item_ids, 'pick', w.ws_code)
                  }}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSearching(g.key)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">
                    Search other watch
                  </button>
                  <button
                    onClick={() => unsureDecide(g.item_ids, 'not_in_catalog')}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                  >
                    Not in catalog
                  </button>
                  <button
                    onClick={() => unsureDecide(g.item_ids, 'discard')}
                    className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!unsure.length && <p className="p-4 text-sm text-gray-500">Nothing waiting</p>}
      </div>
      <Pager page={unsurePage} total={unsureTotal} onPage={setUnsurePage} />
    </div>
  )

  const renderAliases = () => {
    const allSelected = aliases.length > 0 && selectedAliases.length === aliases.length
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b bg-gray-50">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allSelected} onChange={() => setSelectedAliases(allSelected ? [] : aliases.map((a) => a.id))} />
            Select all
          </label>
          <span className="text-sm text-gray-500">{selectedAliases.length} selected</span>
          <span className="ml-auto" />
          <DownloadCsvButton tab="aliases" />
          <button
            disabled={!selectedAliases.length}
            onClick={() => aliasDecide('approve')}
            className="px-3 py-1 text-xs bg-primary text-white rounded disabled:opacity-40"
          >
            Approve
          </button>
          <button
            disabled={!selectedAliases.length}
            onClick={() => aliasDecide('reject')}
            className="px-3 py-1 text-xs border rounded disabled:opacity-40"
          >
            Reject
          </button>
          {selectedAliases.length > 0 && (
            <div className="w-72">
              <WatchSearch placeholder="Assign to other watch" onPick={(w) => aliasDecide('assign', w.ws_code)} />
            </div>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {aliases.map((a) => (
            <label key={a.id} className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedAliases.includes(a.id)}
                onChange={() => setSelectedAliases((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
              />
              <div className="w-48 shrink-0">
                <div className="text-sm font-semibold text-gray-900">“{a.alias}”</div>
                <div className="text-xs text-gray-500">used {a.count}×</div>
              </div>
              <div className="w-64 shrink-0">
                <WatchChip watch={a.watch} wsCode={a.ws_code} />
              </div>
              <div className="flex-1 min-w-0 text-xs text-gray-600 space-y-1">
                {a.examples.slice(0, 2).map((e, i) => (
                  <div key={i} className="truncate">
                    {e}
                  </div>
                ))}
              </div>
            </label>
          ))}
          {!aliases.length && <p className="p-4 text-sm text-gray-500">No suggestions</p>}
        </div>
      </div>
    )
  }

  const renderNew = () => (
    <div>
      <div className="flex justify-end px-4 py-3 border-b">
        <DownloadCsvButton tab="new_watches" />
      </div>
      <div className="divide-y divide-gray-200">
        {newWatches.map((n) => (
          <div key={(n.reference || '') + n.item_ids[0]} className="p-4 flex flex-col lg:flex-row gap-4">
            <AuthImage src={n.image_url} className="w-20 h-20 shrink-0" />
            <div className="w-56 shrink-0">
              <div className="text-sm font-semibold text-gray-900">{n.reference || 'No reference'}</div>
              <div className="text-xs text-gray-500">{n.brand || 'Unknown brand'}</div>
              <div className="text-xs text-gray-700 mt-1">
                {n.count} listing(s) · {n.dealers} dealer(s) · last {formatDate(n.last_seen)}
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {n.examples.map((e, i) => (
                <SourceText key={i} text={e} />
              ))}
            </div>
            <div className="lg:w-72 shrink-0 space-y-2">
              <Link to="/admin/watches" className="block text-xs text-blue-600 hover:underline">
                Create the watch in the catalog
              </Link>
              <WatchSearch
                placeholder="Watch exists now? Import listings to…"
                onPick={(w) =>
                  act(() =>
                    api.post('/approval/new-watches/decide', {
                      item_ids: n.item_ids,
                      action: 'import',
                      ws_code: w.ws_code,
                    })
                  )
                }
              />
              <button
                onClick={() =>
                  act(() =>
                    api.post('/approval/new-watches/decide', {
                      item_ids: n.item_ids,
                      action: 'dismiss',
                    })
                  )
                }
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
        {!newWatches.length && <p className="p-4 text-sm text-gray-500">No suggestions</p>}
      </div>
    </div>
  )

  const renderDiscarded = () => (
    <div>
      <p className="px-4 py-2 text-xs text-gray-500 border-b">Filtered automatically, no action needed. Deleted after 30 days.</p>
      <div className="divide-y divide-gray-200">
        {discarded.map((d) => (
          <div key={d.id} className="p-4 flex flex-col lg:flex-row gap-4">
            <div className="lg:w-56 shrink-0 text-xs text-gray-500">
              <div className="text-sm text-gray-800">{d.reason || 'Discarded'}</div>
              {d.mode} · {d.group_name} · {formatDate(d.created_at)}
            </div>
            <div className="flex-1 min-w-0">
              <SourceText text={d.source_text} />
            </div>
          </div>
        ))}
        {!discarded.length && <p className="p-4 text-sm text-gray-500">Nothing discarded</p>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval</h1>
          <p className="text-sm text-gray-500">Decisions from the automatic generator pipeline</p>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ApprovalFilePanel onChanged={refresh} reloadKey={fileKey} />

      <div className="flex flex-wrap gap-1 border-b mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              tab === t.key ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.count && summary && summary[t.count] > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-700">{summary[t.count]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        {tab === 'prices' ? (
          <SuspiciousPrices
            onChanged={() => {
              loadSummary()
              setFileKey((k) => k + 1)
            }}
            onUndone={() => setFileKey((k) => k + 1)}
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {tab === 'ai' && renderAi()}
            {tab === 'unsure' && renderUnsure()}
            {tab === 'aliases' && renderAliases()}
            {tab === 'new' && renderNew()}
            {tab === 'discarded' && renderDiscarded()}
          </>
        )}
      </div>
    </div>
  )
}
