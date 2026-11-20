import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Edit2, Eye, FileEdit, Image as ImageIcon, Plus, Search, Trash2, Upload, UserRound } from 'lucide-react'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'
import { apiErrorMessage } from '@/features/admin/components/catalog'
import {
  bulkDelete,
  deleteCheck,
  exportCheckPhotos,
  exportChecks,
  listChecks,
  notifyDraftCountsChanged,
  type CheckItem,
  type ListQuery,
} from './checksApi'
import { reporterLabel, STATUS_STYLES, type CollectionConfig } from './checksConfig'
import { CheckFormModal } from './CheckFormModal'
import { BulkEditModal } from './BulkEditModal'
import { ImportModal } from './ImportModal'

const outlineBtn =
  'flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'
const barBtn = 'px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white hover:bg-gray-50 disabled:opacity-50'

function typeLabel(config: CollectionConfig, type?: string) {
  return config.typeOptions?.find((o) => o.value === type)?.label
}

/** One admin list page for a Checks collection, laid out like Content -> Watches. */
export function ChecksListPage({ config }: { config: CollectionConfig }) {
  const [items, setItems] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [formItem, setFormItem] = useState<CheckItem | null | undefined>(undefined)
  const [showImport, setShowImport] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query: ListQuery = { search, status: statusFilter, type: typeFilter }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listChecks(config.collection, {
        search,
        status: statusFilter,
        type: typeFilter,
        page: page + 1,
        page_size: pageSize,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to load ${config.nounPlural}`))
    } finally {
      setLoading(false)
    }
  }, [config, search, statusFilter, typeFilter, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  // Filters change the result set, so go back to the first page.
  useEffect(() => {
    setPage(0)
  }, [search, statusFilter, typeFilter, pageSize])

  const refresh = () => {
    setSelected(new Set())
    notifyDraftCountsChanged()
    void load()
  }

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  const pageFullySelected = items.length > 0 && items.every((i) => selected.has(i.id))
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const i of items) {
        if (pageFullySelected) next.delete(i.id)
        else next.add(i.id)
      }
      return next
    })

  const handleDelete = async (item: CheckItem) => {
    if (!confirm(`Delete this ${config.noun}? This cannot be undone.`)) return
    try {
      await deleteCheck(config.collection, item.id)
      refresh()
    } catch (err) {
      alert(apiErrorMessage(err, 'Delete failed'))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} ${config.nounPlural}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await bulkDelete(config.collection, [...selected])
      flash(`Deleted ${selected.size} ${config.nounPlural}`)
      refresh()
    } catch (err) {
      alert(apiErrorMessage(err, 'Bulk delete failed'))
    } finally {
      setBusy(false)
    }
  }

  const runExport = async (kind: 'csv' | 'xlsx' | 'photos') => {
    setBusy(true)
    try {
      if (kind === 'photos') await exportCheckPhotos(config.collection, query)
      else await exportChecks(config.collection, kind, query)
    } catch (err) {
      alert(apiErrorMessage(err, 'Export failed'))
    } finally {
      setBusy(false)
    }
  }

  const th = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
  const first = total === 0 ? 0 : page * pageSize + 1

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
        <div className="flex flex-wrap gap-2">
          <ExportMenu busy={busy} onExport={runExport} />
          <button onClick={() => setShowImport(true)} className={outlineBtn}>
            <Upload size={18} />
            Bulk Import
          </button>
          <button
            onClick={() => setFormItem(null)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            {config.addLabel}
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-900">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={config.searchPlaceholder}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (timer.current) clearTimeout(timer.current)
                const v = e.target.value
                timer.current = setTimeout(() => setSearch(v), 300)
              }}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          <div className="flex gap-3">
            {config.typeOptions && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
                aria-label="Type"
              >
                <option value="all">All types</option>
                {config.typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm"
              aria-label="Status"
            >
              <option value="all">All statuses</option>
              {config.statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-4 py-2.5 border-b bg-gray-50 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="font-medium text-gray-900">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-gray-500 underline text-xs">
              Clear
            </button>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <button disabled={busy} className={`${barBtn} flex items-center gap-1`} onClick={() => setShowBulkEdit(true)}>
                <FileEdit size={12} /> Bulk Edit
              </button>
              <button
                disabled={busy}
                className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-xs bg-white hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                onClick={handleBulkDelete}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="pl-4 pr-0 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select this page"
                    checked={pageFullySelected}
                    onChange={togglePage}
                    className="h-4 w-4 border-gray-300 rounded"
                  />
                </th>
                <th className={th}>Image + Name</th>
                <th className={th}>Status</th>
                <th className={th}>Views</th>
                <th className={`${th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const img = config.rowImage(item)
                const type = typeLabel(config, item.type)
                return (
                  <tr key={item.id} className={selected.has(item.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="pl-4 pr-0 py-4 w-8">
                      <input
                        type="checkbox"
                        aria-label={`Select ${config.rowName(item)}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-gray-100 shrink-0">
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{config.rowName(item)}</div>
                          <div className="text-sm text-gray-500">{config.rowSub(item)}</div>
                          {item.reporter && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-700">
                              <UserRound className="w-3 h-3" />
                              Reported by {reporterLabel(item.reporter)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {item.status}
                        </span>
                        {type && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
                            {type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Eye className="w-4 h-4 mr-1" />
                        {item.views ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <ActionMenu
                        isOpen={menuOpen === item.id}
                        onToggle={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                        onClose={() => setMenuOpen(null)}
                      >
                        <ActionMenuItem onClick={() => setFormItem(item)} icon={<Edit2 className="w-4 h-4" />}>
                          Edit
                        </ActionMenuItem>
                        <ActionMenuItem
                          onClick={() => handleDelete(item)}
                          variant="danger"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Delete
                        </ActionMenuItem>
                      </ActionMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 mb-2 px-4 py-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">
              Showing {first}–{Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
              aria-label="Page size"
            >
              {[20, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>

        {error && <div className="p-4 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center text-gray-500">No {config.nounPlural} found matching your criteria</div>
        )}
      </div>

      {formItem !== undefined && (
        <CheckFormModal
          config={config}
          item={formItem}
          onClose={() => setFormItem(undefined)}
          onSaved={() => {
            setFormItem(undefined)
            refresh()
          }}
        />
      )}
      {showBulkEdit && (
        <BulkEditModal
          config={config}
          ids={[...selected]}
          onClose={() => setShowBulkEdit(false)}
          onDone={(n) => {
            setShowBulkEdit(false)
            flash(`Updated ${n} ${n === 1 ? config.noun : config.nounPlural}`)
            refresh()
          }}
        />
      )}
      {showImport && (
        <ImportModal
          config={config}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ExportMenu({ busy, onExport }: { busy: boolean; onExport: (k: 'csv' | 'xlsx' | 'photos') => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy} className={outlineBtn} aria-haspopup="menu">
        <Download size={18} />
        Bulk Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-20 py-1 text-sm">
            {(
              [
                ['csv', 'Export CSV'],
                ['xlsx', 'Export XLSX'],
                ['photos', 'Export photos (ZIP)'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="menuitem"
                className="w-full text-left px-4 py-2 hover:bg-gray-50"
                onClick={() => {
                  setOpen(false)
                  onExport(k)
                }}
              >
                {label}
              </button>
            ))}
            <p className="px-4 pt-1 pb-2 text-xs text-gray-500">Uses the current search and filters.</p>
          </div>
        </>
      )}
    </div>
  )
}
