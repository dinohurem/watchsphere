import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, X, RotateCcw } from 'lucide-react'
import { api } from '@/services/api'

type RuleKind = 'remark' | 'aftermarket' | 'aftermarket_exception'
type RuleMode = 'BOTH' | 'WTS' | 'WTB'
type PlaceKind = 'country' | 'city'

interface Rule {
  id: string
  remark: string
  triggers: string[]
  category: string
  kind: RuleKind
  mode: RuleMode
  enabled: boolean
  order: number
}

interface Place {
  id: string
  name: string
  aliases: string[]
  kind: PlaceKind
  enabled: boolean
  order: number
}

interface RemarksData {
  rules: Rule[]
  places: Place[]
  categories: string[]
  kinds: string[]
  modes: string[]
}

interface RuleForm {
  remark: string
  triggers: string
  category: string
  kind: RuleKind
  mode: RuleMode
  enabled: boolean
}

interface PlaceForm {
  name: string
  aliases: string
  kind: PlaceKind
  enabled: boolean
}

type Tab = 'remarks' | 'aftermarket' | 'places'

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errMsg = (err: any, fallback: string) => err?.response?.data?.detail || err?.message || fallback

const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm'

function ModeBadge({ mode }: { mode: RuleMode }) {
  const label = mode === 'BOTH' ? 'Both' : mode
  const cls =
    mode === 'WTS'
      ? 'bg-blue-100 text-blue-800'
      : mode === 'WTB'
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-700'
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-gray-400 text-xs">No triggers</span>
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
          {t}
        </span>
      ))}
    </div>
  )
}

export function AdminRemarks() {
  const [data, setData] = useState<RemarksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('remarks')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const [ruleModal, setRuleModal] = useState<{ id: string | null; form: RuleForm } | null>(null)
  const [placeModal, setPlaceModal] = useState<{ id: string | null; form: PlaceForm } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<RemarksData>('/admin/remarks')
      setData(res.data)
    } catch (err) {
      setError(errMsg(err, 'Failed to load remarks'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const upsertRule = (rule: Rule) =>
    setData((d) =>
      d
        ? {
            ...d,
            rules: d.rules.some((r) => r.id === rule.id)
              ? d.rules.map((r) => (r.id === rule.id ? rule : r))
              : [...d.rules, rule],
            categories: d.categories.includes(rule.category)
              ? d.categories
              : [...d.categories, rule.category],
          }
        : d
    )

  const upsertPlace = (place: Place) =>
    setData((d) =>
      d
        ? {
            ...d,
            places: d.places.some((p) => p.id === place.id)
              ? d.places.map((p) => (p.id === place.id ? place : p))
              : [...d.places, place],
          }
        : d
    )

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errMsg(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const toggleRule = (rule: Rule) =>
    run(async () => {
      const res = await api.put<Rule>(`/admin/remarks/rules/${rule.id}`, { enabled: !rule.enabled })
      upsertRule(res.data)
    }, 'Failed to update rule')

  const deleteRule = (rule: Rule) => {
    if (!window.confirm(`Delete "${rule.remark}"?`)) return
    run(async () => {
      await api.delete(`/admin/remarks/rules/${rule.id}`)
      setData((d) => (d ? { ...d, rules: d.rules.filter((r) => r.id !== rule.id) } : d))
    }, 'Failed to delete rule')
  }

  const saveRule = () => {
    if (!ruleModal) return
    const { id, form } = ruleModal
    if (!form.remark.trim()) {
      setError('Remark text is required')
      return
    }
    const body = {
      remark: form.remark.trim(),
      triggers: splitList(form.triggers),
      category: form.category.trim(),
      kind: form.kind,
      mode: form.mode,
      enabled: form.enabled,
    }
    run(async () => {
      const res = id
        ? await api.put<Rule>(`/admin/remarks/rules/${id}`, body)
        : await api.post<Rule>('/admin/remarks/rules', body)
      upsertRule(res.data)
      setRuleModal(null)
    }, 'Failed to save rule')
  }

  const togglePlace = (place: Place) =>
    run(async () => {
      const res = await api.put<Place>(`/admin/remarks/places/${place.id}`, {
        enabled: !place.enabled,
      })
      upsertPlace(res.data)
    }, 'Failed to update place')

  const deletePlace = (place: Place) => {
    if (!window.confirm(`Delete "${place.name}"?`)) return
    run(async () => {
      await api.delete(`/admin/remarks/places/${place.id}`)
      setData((d) => (d ? { ...d, places: d.places.filter((p) => p.id !== place.id) } : d))
    }, 'Failed to delete place')
  }

  const savePlace = () => {
    if (!placeModal) return
    const { id, form } = placeModal
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    const body = {
      name: form.name.trim(),
      aliases: splitList(form.aliases),
      kind: form.kind,
      enabled: form.enabled,
    }
    run(async () => {
      const res = id
        ? await api.put<Place>(`/admin/remarks/places/${id}`, body)
        : await api.post<Place>('/admin/remarks/places', body)
      upsertPlace(res.data)
      setPlaceModal(null)
    }, 'Failed to save place')
  }

  const reset = () => {
    if (
      !window.confirm(
        'Restore the built-in defaults? All custom remarks, triggers and places will be replaced.'
      )
    )
      return
    run(async () => {
      const res = await api.post<RemarksData>('/admin/remarks/reset')
      setData(res.data)
    }, 'Failed to restore defaults')
  }

  const q = search.trim().toLowerCase()
  const matchRule = (r: Rule) =>
    !q || r.remark.toLowerCase().includes(q) || r.triggers.some((t) => t.toLowerCase().includes(q))
  const matchPlace = (p: Place) =>
    !q || p.name.toLowerCase().includes(q) || p.aliases.some((a) => a.toLowerCase().includes(q))

  const sortedRules = useMemo(
    () => [...(data?.rules ?? [])].sort((a, b) => a.order - b.order),
    [data?.rules]
  )

  const remarkGroups = useMemo(() => {
    const groups = new Map<string, Rule[]>()
    sortedRules
      .filter((r) => r.kind === 'remark' && matchRule(r))
      .forEach((r) => {
        const key = r.category || 'Uncategorised'
        groups.set(key, [...(groups.get(key) ?? []), r])
      })
    return Array.from(groups.entries())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRules, q])

  const aftermarket = sortedRules.filter((r) => r.kind === 'aftermarket' && matchRule(r))
  const exceptions = sortedRules.filter((r) => r.kind === 'aftermarket_exception' && matchRule(r))
  const places = [...(data?.places ?? [])].sort((a, b) => a.order - b.order).filter(matchPlace)

  const openNewRule = () =>
    setRuleModal({
      id: null,
      form: {
        remark: '',
        triggers: '',
        category: tab === 'remarks' ? (data?.categories[0] ?? '') : '',
        kind: tab === 'aftermarket' ? 'aftermarket' : 'remark',
        mode: 'BOTH',
        enabled: true,
      },
    })

  const openEditRule = (r: Rule) =>
    setRuleModal({
      id: r.id,
      form: {
        remark: r.remark,
        triggers: r.triggers.join(', '),
        category: r.category,
        kind: r.kind,
        mode: r.mode,
        enabled: r.enabled,
      },
    })

  const renderRuleRow = (r: Rule) => (
    <div key={r.id} className={`flex items-start gap-4 px-4 py-3 hover:bg-gray-50 ${r.enabled ? '' : 'opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{r.remark}</span>
          <ModeBadge mode={r.mode} />
        </div>
        <Chips items={r.triggers} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => toggleRule(r)}
          disabled={busy}
          className="p-1 rounded hover:bg-gray-100"
          title={r.enabled ? 'Disable' : 'Enable'}
        >
          {r.enabled ? (
            <ToggleRight className="w-6 h-6 text-green-600" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-gray-400" />
          )}
        </button>
        <button onClick={() => openEditRule(r)} className="p-2 rounded hover:bg-gray-100" title="Edit">
          <Edit2 className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={() => deleteRule(r)}
          disabled={busy}
          className="p-2 rounded hover:bg-gray-100"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      </div>
    </div>
  )

  const section = (title: string, rows: Rule[], hint?: string) => (
    <div key={title} className="border-b last:border-b-0">
      <div className="px-4 py-2 bg-gray-50 border-b">
        <h3 className="text-sm font-semibold text-gray-700">
          {title} <span className="font-normal text-gray-500">({rows.length})</span>
        </h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {rows.length ? (
        <div className="divide-y divide-gray-200">{rows.map(renderRuleRow)}</div>
      ) : (
        <p className="px-4 py-3 text-sm text-gray-500">Nothing here</p>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const tabBtn = (key: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
        tab === key
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label} ({count})
    </button>
  )

  const rules = data?.rules ?? []

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remarks</h1>
          <p className="text-gray-600">
            Remarks and triggers are applied by the WTS/WTB generator at every run. Numeric remarks
            (links, Serviced + year, LC number, discount %, Wood Card with W + month) are built into
            the code and are not listed here.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={reset}
            disabled={busy}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restore defaults
          </button>
          <button
            onClick={() =>
              tab === 'places'
                ? setPlaceModal({ id: null, form: { name: '', aliases: '', kind: 'country', enabled: true } })
                : openNewRule()
            }
            disabled={!data}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {tab === 'places' ? 'Add place' : 'Add rule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!data ? (
        <div className="bg-white rounded-lg border shadow-sm p-6 text-center">
          <button
            onClick={load}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="flex border-b overflow-x-auto">
            {tabBtn('remarks', 'Remarks', rules.filter((r) => r.kind === 'remark').length)}
            {tabBtn('aftermarket', 'Aftermarket', rules.filter((r) => r.kind !== 'remark').length)}
            {tabBtn('places', 'Places', data.places.length)}
          </div>

          <div className="p-4 border-b">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={tab === 'places' ? 'Search name or alias...' : 'Search remark or trigger...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
              />
            </div>
          </div>

          {tab === 'remarks' &&
            (remarkGroups.length ? (
              remarkGroups.map(([cat, rows]) => section(cat, rows))
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No remarks found</p>
            ))}

          {tab === 'aftermarket' && (
            <>
              {section('Never imported', aftermarket, 'Listings matching these triggers are flagged as aftermarket and not imported')}
              {section('Exceptions', exceptions, 'Triggers that override the aftermarket rules')}
            </>
          )}

          {tab === 'places' && (
            <div className="divide-y divide-gray-200">
              {places.length ? (
                places.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-start gap-4 px-4 py-3 hover:bg-gray-50 ${p.enabled ? '' : 'opacity-60'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{p.name}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {p.kind === 'city' ? 'City' : 'Country'}
                        </span>
                      </div>
                      <Chips items={p.aliases} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePlace(p)}
                        disabled={busy}
                        className="p-1 rounded hover:bg-gray-100"
                        title={p.enabled ? 'Disable' : 'Enable'}
                      >
                        {p.enabled ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setPlaceModal({
                            id: p.id,
                            form: { name: p.name, aliases: p.aliases.join(', '), kind: p.kind, enabled: p.enabled },
                          })
                        }
                        className="p-2 rounded hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deletePlace(p)}
                        disabled={busy}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-sm text-gray-500 text-center">No places found</p>
              )}
            </div>
          )}
        </div>
      )}

      {ruleModal && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{ruleModal.id ? 'Edit rule' : 'Add rule'}</h2>
              <button onClick={() => setRuleModal(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                <input
                  className={inputCls}
                  value={ruleModal.form.remark}
                  onChange={(e) => setRuleModal({ ...ruleModal, form: { ...ruleModal.form, remark: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  className={inputCls}
                  list="remark-categories"
                  value={ruleModal.form.category}
                  placeholder="Pick or type a new category"
                  onChange={(e) => setRuleModal({ ...ruleModal, form: { ...ruleModal.form, category: e.target.value } })}
                />
                <datalist id="remark-categories">
                  {data.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
                  <select
                    className={inputCls}
                    value={ruleModal.form.kind}
                    onChange={(e) =>
                      setRuleModal({ ...ruleModal, form: { ...ruleModal.form, kind: e.target.value as RuleKind } })
                    }
                  >
                    <option value="remark">Remark</option>
                    <option value="aftermarket">Aftermarket (never imported)</option>
                    <option value="aftermarket_exception">Aftermarket exception</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <select
                    className={inputCls}
                    value={ruleModal.form.mode}
                    onChange={(e) =>
                      setRuleModal({ ...ruleModal, form: { ...ruleModal.form, mode: e.target.value as RuleMode } })
                    }
                  >
                    <option value="BOTH">Both</option>
                    <option value="WTS">WTS</option>
                    <option value="WTB">WTB</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Triggers</label>
                <input
                  className={inputCls}
                  value={ruleModal.form.triggers}
                  placeholder="Comma separated, e.g. full set, fullset"
                  onChange={(e) => setRuleModal({ ...ruleModal, form: { ...ruleModal.form, triggers: e.target.value } })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={ruleModal.form.enabled}
                  onChange={(e) => setRuleModal({ ...ruleModal, form: { ...ruleModal.form, enabled: e.target.checked } })}
                />
                Enabled
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => setRuleModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {placeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{placeModal.id ? 'Edit place' : 'Add place'}</h2>
              <button onClick={() => setPlaceModal(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className={inputCls}
                  value={placeModal.form.name}
                  onChange={(e) => setPlaceModal({ ...placeModal, form: { ...placeModal.form, name: e.target.value } })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
                <select
                  className={inputCls}
                  value={placeModal.form.kind}
                  onChange={(e) =>
                    setPlaceModal({ ...placeModal, form: { ...placeModal.form, kind: e.target.value as PlaceKind } })
                  }
                >
                  <option value="country">Country</option>
                  <option value="city">City</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aliases</label>
                <input
                  className={inputCls}
                  value={placeModal.form.aliases}
                  placeholder="Comma separated, e.g. HK, Hongkong"
                  onChange={(e) => setPlaceModal({ ...placeModal, form: { ...placeModal.form, aliases: e.target.value } })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={placeModal.form.enabled}
                  onChange={(e) => setPlaceModal({ ...placeModal, form: { ...placeModal.form, enabled: e.target.checked } })}
                />
                Enabled
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => setPlaceModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={savePlace}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
