import { api } from '@/services/api'

export interface ListPriceCountry {
  code: string
  name: string
  currency: string
  tax_label: string
  vat_pct: number | null
}

export interface CatalogFilters {
  status?: string
  brand?: string
  search?: string
  no_image?: boolean
  no_ws_code?: boolean
  no_aliases?: boolean
  no_list_price?: boolean
}

export type SelectionMode = 'ids' | 'filtered' | 'all'

export interface Selection {
  mode: SelectionMode
  ids: string[]
  filters: CatalogFilters
}

export interface ChangeBatch {
  id: string
  kind: string
  summary: string
  created_at: string
  created_by_name: string | null
  updated_count: number
  created_count: number
  deleted_count: number
  undone_at: string | null
}

export interface UndoTarget {
  batchId: string
  summary: string
}

/** Same 13 countries as app/core/market_constants.py; used until the API answers. */
export const FALLBACK_LIST_PRICE_COUNTRIES: ListPriceCountry[] = [
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', tax_label: 'no VAT', vat_pct: 0 },
  { code: 'DE', name: 'Germany', currency: 'EUR', tax_label: 'incl. 19% VAT', vat_pct: 19 },
  { code: 'AE', name: 'UAE', currency: 'AED', tax_label: 'incl. 5% VAT', vat_pct: 5 },
  { code: 'US', name: 'United States', currency: 'USD', tax_label: 'excl. sales tax', vat_pct: null },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', tax_label: 'incl. 20% VAT', vat_pct: 20 },
  { code: 'CN', name: 'China', currency: 'CNY', tax_label: 'incl. 13% VAT', vat_pct: 13 },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', tax_label: 'incl. 8.1% VAT', vat_pct: 8.1 },
  { code: 'IT', name: 'Italy', currency: 'EUR', tax_label: 'incl. 22% VAT', vat_pct: 22 },
  { code: 'ES', name: 'Spain', currency: 'EUR', tax_label: 'incl. 21% VAT', vat_pct: 21 },
  { code: 'AT', name: 'Austria', currency: 'EUR', tax_label: 'incl. 20% VAT', vat_pct: 20 },
  { code: 'FR', name: 'France', currency: 'EUR', tax_label: 'incl. 20% VAT', vat_pct: 20 },
  { code: 'JP', name: 'Japan', currency: 'JPY', tax_label: 'incl. 10% VAT', vat_pct: 10 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', tax_label: 'incl. 9% GST', vat_pct: 9 },
]

/** Drops empty / false filter values so they are not sent as query params. */
export function cleanFilters(filters: CatalogFilters): CatalogFilters {
  const out: CatalogFilters = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false || value === 'all') continue
    ;(out as Record<string, unknown>)[key] = value
  }
  return out
}

/** Query params for /market/admin/all and /market/admin/count. */
export function filtersToParams(filters: CatalogFilters): Record<string, string | boolean> {
  const clean = cleanFilters(filters)
  const params: Record<string, string | boolean> = {}
  if (clean.status) params.status_filter = clean.status
  if (clean.brand) params.brand = clean.brand
  if (clean.search) params.search = clean.search
  if (clean.no_image) params.no_image = true
  if (clean.no_ws_code) params.no_ws_code = true
  if (clean.no_aliases) params.no_aliases = true
  if (clean.no_list_price) params.no_list_price = true
  return params
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return `${detail[0].loc?.slice(1).join('.')}: ${detail[0].msg}`
  return fallback
}

export async function exportWatches(selection: Selection, format: 'jsonl' | 'csv') {
  const response = await api.post(
    '/catalog-admin/watches/export',
    { format, selection: { ...selection, filters: cleanFilters(selection.filters) } },
    { responseType: 'blob', timeout: 0 }
  )
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `watches_export_${stamp}.${format}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function undoBatch(batchId: string) {
  const response = await api.post(`/catalog-admin/batches/${batchId}/undo`)
  return response.data as { restored: number; deleted: number; recreated: number; skipped: number }
}

export function describeUndo(result: { restored: number; deleted: number; recreated: number; skipped: number }) {
  const parts: string[] = []
  if (result.restored) parts.push(`${result.restored} restored`)
  if (result.recreated) parts.push(`${result.recreated} brought back`)
  if (result.deleted) parts.push(`${result.deleted} removed`)
  if (result.skipped) parts.push(`${result.skipped} skipped`)
  return parts.length ? `Undone · ${parts.join(' · ')}` : 'Undone'
}
