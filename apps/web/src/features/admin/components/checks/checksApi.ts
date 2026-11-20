import { api } from '@/services/api'

export type CheckStatus = 'draft' | 'published' | 'rejected'
export type CollectionKey = 'serial-reports' | 'dealer-numbers' | 'bracelets'

export interface Reporter {
  id: string
  name?: string | null
  email?: string | null
}

export interface CheckItem {
  id: string
  status: CheckStatus
  views: number
  created_at?: string
  updated_at?: string
  reporter?: Reporter | null
  type?: string
  [key: string]: unknown
}

export interface ListResponse {
  items: CheckItem[]
  total: number
  page: number
  page_size: number
}

export interface ListQuery {
  search?: string
  status?: string
  type?: string
  page?: number
  page_size?: number
}

export type ImportRowStatus = 'new' | 'duplicate' | 'conflict' | 'invalid'

export interface ImportPreviewRow {
  row: number
  data: Record<string, unknown>
  status: ImportRowStatus
  message?: string | null
  existing_id?: string | null
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  token: string
}

export interface ImportCommitResult {
  created: number
  updated: number
  skipped: number
}

export type DuplicateMode = 'skip' | 'update'

const base = (c: CollectionKey) => `/admin/checks/${c}`

/** Drop empty filter values and the "all" sentinel before they reach the API. */
export function cleanQuery(q: ListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === '' || v === 'all') continue
    out[k] = v as string | number
  }
  return out
}

export async function listChecks(c: CollectionKey, q: ListQuery): Promise<ListResponse> {
  const { data } = await api.get(base(c), { params: cleanQuery(q) })
  return data
}

export async function createCheck(c: CollectionKey, body: Record<string, unknown>) {
  const { data } = await api.post(base(c), body)
  return data
}

export async function updateCheck(c: CollectionKey, id: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`${base(c)}/${id}`, body)
  return data
}

export async function deleteCheck(c: CollectionKey, id: string) {
  await api.delete(`${base(c)}/${id}`)
}

export async function bulkEdit(c: CollectionKey, ids: string[], set: Record<string, unknown>) {
  const { data } = await api.post(`${base(c)}/bulk-edit`, { ids, set })
  return data
}

export async function bulkDelete(c: CollectionKey, ids: string[]) {
  const { data } = await api.post(`${base(c)}/bulk-delete`, { ids })
  return data
}

export async function previewImport(
  c: CollectionKey,
  file: File,
  photos?: File | null
): Promise<ImportPreview> {
  const form = new FormData()
  form.append('file', file)
  if (photos) form.append('photos', photos)
  const { data } = await api.post(`${base(c)}/import/preview`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
  })
  return data
}

export type ConflictMode = 'skip' | 'import'

export async function commitImport(
  c: CollectionKey,
  token: string,
  opts: { duplicates: DuplicateMode; conflicts: ConflictMode; skipRows: number[] }
): Promise<ImportCommitResult> {
  const { data } = await api.post(
    `${base(c)}/import/commit`,
    { token, duplicates: opts.duplicates, conflicts: opts.conflicts, skip_rows: opts.skipRows },
    { timeout: 0 }
  )
  return data
}

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
}

function filtersOnly(q: ListQuery) {
  const { search, status, type } = q
  return cleanQuery({ search, status, type })
}

export async function exportChecks(c: CollectionKey, format: 'csv' | 'xlsx', q: ListQuery) {
  const response = await api.get(`${base(c)}/export`, {
    params: { format, ...filtersOnly(q) },
    responseType: 'blob',
    timeout: 0,
  })
  saveBlob(new Blob([response.data]), `${c}_export_${stamp()}.${format}`)
}

export async function exportCheckPhotos(c: CollectionKey, q: ListQuery) {
  const response = await api.get(`${base(c)}/export-photos`, {
    params: filtersOnly(q),
    responseType: 'blob',
    timeout: 0,
  })
  saveBlob(new Blob([response.data]), `${c}_photos_${stamp()}.zip`)
}

export interface DraftCounts {
  serial_reports: number
  dealer_numbers: number
}

export async function fetchDraftCounts(): Promise<DraftCounts> {
  const { data } = await api.get('/admin/checks/draft-counts')
  return data
}

/** Tell the sidebar to refetch badge counts after a status change. */
export const DRAFT_COUNTS_EVENT = 'checks:draft-counts-changed'
export function notifyDraftCountsChanged() {
  window.dispatchEvent(new Event(DRAFT_COUNTS_EVENT))
}
