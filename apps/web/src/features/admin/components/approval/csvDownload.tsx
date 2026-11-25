import { useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '@/services/api'

export type CaseTab = 'ai' | 'unsure' | 'aliases' | 'new_watches' | 'prices'

/** Streams a CSV from the backend (admin auth needs the bearer token, so no plain link). */
export async function downloadCsv(path: string, params: Record<string, string | undefined>, filename: string) {
  const clean: Record<string, string> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v) clean[k] = v
  })
  const res = await api.get(path, { params: clean, responseType: 'blob', timeout: 0 })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** "Download CSV" of one tab: one row per case, empty decision / new_value columns to fill in. */
export function DownloadCsvButton({ tab, params = {} }: { tab: CaseTab; params?: Record<string, string | undefined> }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadCsv(`/approval/file/export/${tab}`, params, `approval_${tab}.csv`)
        } catch (error) {
          console.error(error)
          alert('Download failed')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
    >
      <Download className="w-3 h-3" /> {busy ? 'Preparing…' : 'Download CSV'}
    </button>
  )
}
