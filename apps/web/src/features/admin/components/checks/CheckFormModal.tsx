import { useState } from 'react'
import { X } from 'lucide-react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { apiErrorMessage } from '@/features/admin/components/catalog'
import { DIAL_COUNTRIES, dialLabel } from './countries'
import { createCheck, updateCheck, type CheckItem } from './checksApi'
import { reporterLabel, type CollectionConfig, type FieldDef } from './checksConfig'

const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const UPLOAD_ENDPOINT = '/upload/market'

interface FieldInputProps {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  /** Bulk Edit uses plain controls without the required marker. */
  bare?: boolean
}

/** One form control, styled like the Add New Watch form. Shared with Bulk Edit. */
export function FieldInput({ field, value, onChange, bare }: FieldInputProps) {
  const v = value === undefined || value === null ? '' : String(value)
  const required = !bare && field.required

  switch (field.kind) {
    case 'select':
      return (
        <select
          required={required}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          aria-label={field.label}
        >
          {(bare || !field.required) && <option value="">{bare ? 'Choose...' : 'Not set'}</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'country_code':
      return (
        <select
          required={required}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          aria-label={field.label}
        >
          {bare && <option value="">Choose...</option>}
          {DIAL_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.code}>
              {dialLabel(c)}
            </option>
          ))}
        </select>
      )
    case 'textarea':
      return (
        <textarea
          rows={3}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          min={0}
          required={required}
          value={v}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          value={v ? v.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          aria-label={field.label}
        />
      )
    case 'photo':
      return (
        <ImageUpload
          value={v || undefined}
          onChange={(url) => onChange(url || '')}
          uploadEndpoint={UPLOAD_ENDPOINT}
          label={field.label}
        />
      )
    case 'photos': {
      const urls = Array.isArray(value) ? (value as string[]) : []
      return (
        <div>
          {urls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {urls.map((u) => (
                <div key={u} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => onChange(urls.filter((x) => x !== u))}
                    className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageUpload
            value={undefined}
            onChange={(url) => url && onChange([...urls, url])}
            uploadEndpoint={UPLOAD_ENDPOINT}
            label={field.label}
          />
        </div>
      )
    }
    default:
      return (
        <input
          type="text"
          required={required}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      )
  }
}

function fieldLabel(f: FieldDef) {
  return f.kind === 'photo' || f.kind === 'photos' ? null : (
    <label className={labelCls}>
      {f.label}
      {f.required ? ' *' : ''}
    </label>
  )
}

interface Props {
  config: CollectionConfig
  item: CheckItem | null
  onClose: () => void
  onSaved: () => void
}

export function CheckFormModal({ config, item, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!item) return { ...config.defaults }
    const v: Record<string, unknown> = {}
    for (const f of config.fields) v[f.key] = item[f.key] ?? config.defaults[f.key] ?? ''
    return v
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, v: unknown) => setValues((prev) => ({ ...prev, [key]: v }))
  const visible = config.fields.filter((f) => !f.showWhen || f.showWhen(values))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {}
    for (const f of visible) body[f.key] = values[f.key] === '' ? null : values[f.key]
    // Fields hidden by the current type are cleared so they do not linger.
    for (const f of config.fields) if (!visible.includes(f)) body[f.key] = null
    try {
      if (item) await updateCheck(config.collection, item.id, body)
      else await createCheck(config.collection, body)
      onSaved()
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  // Lay out half-width fields two to a row, like Add New Watch.
  const rows: FieldDef[][] = []
  for (const f of visible) {
    const last = rows[rows.length - 1]
    if (f.half && last && last.length === 1 && last[0].half) last.push(f)
    else rows.push([f])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? config.formTitleEdit : config.formTitleNew}
          </h2>
          {item?.reporter && (
            <p className="mt-1 text-sm text-gray-500">
              Reported by <strong>{reporterLabel(item.reporter)}</strong>
              {item.reporter.email && item.reporter.name ? ` (${item.reporter.email})` : ''} · internal,
              never shown to other users
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {rows.map((row) => (
            <div key={row[0].key} className={row.length > 1 ? 'grid grid-cols-2 gap-4' : ''}>
              {row.map((f) => (
                <div key={f.key}>
                  {fieldLabel(f)}
                  <FieldInput field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                  {f.note && <p className="mt-1 text-xs text-gray-500">{f.note}</p>}
                </div>
              ))}
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : item ? `Update ${config.noun}` : `Create ${config.noun}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
