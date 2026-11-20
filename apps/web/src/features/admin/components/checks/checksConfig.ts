import type { CheckItem, CollectionKey } from './checksApi'

export type FieldKind = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'country_code' | 'photos' | 'photo'

export interface Option {
  value: string
  label: string
}

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  placeholder?: string
  options?: Option[]
  /** Render the field half-width, two to a row (like Add New Watch). */
  half?: boolean
  /** Hide the field unless this returns true for the current form values. */
  showWhen?: (values: Record<string, unknown>) => boolean
  /** Offered in Bulk Edit (photos never are). */
  bulk?: boolean
  note?: string
}

export interface CollectionConfig {
  collection: CollectionKey
  /** Page heading and list noun. */
  title: string
  noun: string
  nounPlural: string
  addLabel: string
  formTitleNew: string
  formTitleEdit: string
  searchPlaceholder: string
  typeOptions?: Option[]
  statusOptions: Option[]
  fields: FieldDef[]
  rowName: (item: CheckItem) => string
  rowSub: (item: CheckItem) => string
  rowImage: (item: CheckItem) => string | undefined
  /** Defaults for a new record. */
  defaults: Record<string, unknown>
  importColumns: string
}

const STATUS_ALL: Option[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

export const HOW_STOLEN_OPTIONS: Option[] = [
  { value: 'burglary', label: 'Burglary' },
  { value: 'robbery', label: 'Robbery' },
  { value: 'armed_robbery', label: 'Armed robbery' },
  { value: 'home_invasion', label: 'Home invasion' },
  { value: 'snatch_pickpocket', label: 'Snatch / pickpocket' },
  { value: 'scam_paid_never_delivered', label: 'Scam – paid, never delivered' },
  { value: 'scam_delivered_never_paid', label: 'Scam – delivered, never paid' },
  { value: 'scam_fake_money', label: 'Scam – paid with fake money' },
  { value: 'scam_fake_crypto', label: 'Scam – paid with fake crypto' },
  { value: 'consignment_not_returned', label: 'Consignment not returned' },
  { value: 'stolen_in_transit', label: 'Stolen in transit' },
  { value: 'switched_watch', label: 'Switched watch' },
  { value: 'other', label: 'Other' },
]

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))
const join = (parts: unknown[], sep = ' ') =>
  parts.map(str).filter(Boolean).join(sep)

const firstPhoto = (item: CheckItem): string | undefined => {
  const thumb = item.photo_thumb_url
  if (typeof thumb === 'string' && thumb) return thumb
  const one = item.photo_url
  if (typeof one === 'string' && one) return one
  const many = item.photo_urls
  if (Array.isArray(many) && typeof many[0] === 'string') return many[0]
  return undefined
}

export const serialReportsConfig: CollectionConfig = {
  collection: 'serial-reports',
  title: 'Serial reports',
  noun: 'serial report',
  nounPlural: 'serial reports',
  addLabel: 'Add serial report',
  formTitleNew: 'Add New Serial Report',
  formTitleEdit: 'Edit Serial Report',
  searchPlaceholder: 'Search serial, reference, brand...',
  typeOptions: [
    { value: 'stolen', label: 'Stolen' },
    { value: 'counterfeit', label: 'Counterfeit' },
    { value: 'frankenstein', label: 'Frankenstein' },
    { value: 'fake_papers', label: 'Fake papers' },
  ],
  statusOptions: STATUS_ALL,
  defaults: { type: 'stolen', status: 'published', photo_urls: [] },
  importColumns:
    'type, serial, brand, model, reference, how_stolen, date, location, who_offered, details, status, photo_filename',
  rowName: (i) => join([i.brand, i.model]) || str(i.serial) || '-',
  rowSub: (i) => join([i.serial, i.reference], ' · '),
  rowImage: firstPhoto,
  fields: [
    {
      key: 'type',
      label: 'Type',
      kind: 'select',
      required: true,
      half: true,
      bulk: true,
      options: [
        { value: 'stolen', label: 'Stolen' },
        { value: 'counterfeit', label: 'Counterfeit' },
        { value: 'frankenstein', label: 'Frankenstein' },
        { value: 'fake_papers', label: 'Fake papers' },
      ],
    },
    { key: 'status', label: 'Status', kind: 'select', half: true, bulk: true, options: STATUS_ALL, required: true },
    { key: 'serial', label: 'Serial number', kind: 'text', required: true, half: true, placeholder: 'e.g., 3Y0R9842', bulk: true },
    { key: 'reference', label: 'Reference', kind: 'text', required: true, half: true, placeholder: 'e.g., 116500LN', bulk: true },
    { key: 'brand', label: 'Brand', kind: 'text', half: true, placeholder: 'e.g., Rolex', bulk: true },
    { key: 'model', label: 'Model', kind: 'text', half: true, placeholder: 'e.g., Daytona', bulk: true },
    {
      key: 'how_stolen',
      label: 'How it was stolen',
      kind: 'select',
      options: HOW_STOLEN_OPTIONS,
      showWhen: (v) => v.type === 'stolen',
      bulk: true,
    },
    { key: 'date_of_incident', label: 'Date of incident', kind: 'date', half: true, bulk: true },
    { key: 'location', label: 'Location', kind: 'text', half: true, placeholder: 'e.g., Munich, Germany', bulk: true },
    {
      key: 'who_offered',
      label: 'Who offered it',
      kind: 'text',
      placeholder: 'Name or phone number',
      showWhen: (v) => v.type !== 'stolen',
      bulk: true,
    },
    { key: 'details', label: 'Details', kind: 'textarea', placeholder: 'The story shown on the detail screens', bulk: true },
    {
      key: 'photo_urls',
      label: 'Photos / documents',
      kind: 'photos',
      note: 'Internal only, never shown to other users.',
    },
  ],
}

export const dealerNumbersConfig: CollectionConfig = {
  collection: 'dealer-numbers',
  title: 'Dealer numbers',
  noun: 'dealer number',
  nounPlural: 'dealer numbers',
  addLabel: 'Add dealer number',
  formTitleNew: 'Add New Dealer Number',
  formTitleEdit: 'Edit Dealer Number',
  searchPlaceholder: 'Search number, name, country...',
  typeOptions: [
    { value: 'verified', label: 'Verified dealer' },
    { value: 'scammer', label: 'Scammer' },
  ],
  statusOptions: STATUS_ALL,
  defaults: { type: 'verified', status: 'published', country_code: '+852', photo_urls: [] },
  importColumns: 'type, country_code, phone, name, country, details, status, photo_filename',
  rowName: (i) => str(i.name) || str(i.e164) || join([i.country_code, i.phone]),
  rowSub: (i) => {
    const num = str(i.e164) || join([i.country_code, i.phone])
    return join([num, i.type === 'scammer' ? 'Scammer' : 'Verified dealer'], ' · ')
  },
  rowImage: firstPhoto,
  fields: [
    {
      key: 'type',
      label: 'Type',
      kind: 'select',
      required: true,
      half: true,
      bulk: true,
      options: [
        { value: 'verified', label: 'Verified dealer' },
        { value: 'scammer', label: 'Scammer' },
      ],
    },
    { key: 'status', label: 'Status', kind: 'select', half: true, bulk: true, options: STATUS_ALL, required: true },
    { key: 'country_code', label: 'Country code', kind: 'country_code', required: true, half: true, bulk: true },
    { key: 'phone', label: 'Phone number', kind: 'text', required: true, half: true, placeholder: 'e.g., 6123 4567' },
    { key: 'name', label: 'Name', kind: 'text', half: true, placeholder: 'Dealer or scammer name (internal only)', bulk: true },
    { key: 'country', label: 'Country', kind: 'text', half: true, placeholder: 'e.g., Hong Kong', bulk: true },
    {
      key: 'details',
      label: 'Details',
      kind: 'textarea',
      placeholder: 'The story shown on the detail screen',
      showWhen: (v) => v.type === 'scammer',
      bulk: true,
    },
    { key: 'photo_urls', label: 'Photos / documents', kind: 'photos', note: 'Internal only.' },
  ],
}

export const braceletsConfig: CollectionConfig = {
  collection: 'bracelets',
  title: 'Bracelets',
  noun: 'bracelet',
  nounPlural: 'bracelets',
  addLabel: 'Add bracelet',
  formTitleNew: 'Add New Bracelet',
  formTitleEdit: 'Edit Bracelet',
  searchPlaceholder: 'Search reference, bracelet, brand...',
  statusOptions: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ],
  defaults: { status: 'published', sort_order: 0 },
  importColumns: 'brand, model, reference, bracelet, full_links, notes, sort_order, status, photo_filename',
  rowName: (i) => str(i.bracelet) || str(i.name) || '-',
  rowSub: (i) => join([join([i.brand, i.model]), i.reference, i.full_links ? `${i.full_links} links` : ''], ' · '),
  rowImage: firstPhoto,
  fields: [
    { key: 'brand', label: 'Brand', kind: 'text', half: true, placeholder: 'e.g., Rolex', bulk: true },
    { key: 'model', label: 'Model', kind: 'text', half: true, placeholder: 'e.g., Datejust 41', bulk: true },
    { key: 'reference', label: 'Reference', kind: 'text', required: true, half: true, placeholder: 'e.g., 126334', bulk: true },
    { key: 'bracelet', label: 'Bracelet', kind: 'text', required: true, half: true, placeholder: 'e.g., Oyster, Jubilee, President', bulk: true },
    { key: 'full_links', label: 'Full links', kind: 'number', required: true, half: true, placeholder: 'e.g., 13', bulk: true },
    { key: 'sort_order', label: 'Sort order', kind: 'number', half: true, placeholder: '0', bulk: true },
    {
      key: 'notes',
      label: 'Notes',
      kind: 'textarea',
      placeholder: 'What is counted, Easylink, differences by production year',
      bulk: true,
    },
    {
      key: 'photo_url',
      label: 'Photo',
      kind: 'photo',
      note: 'Full bracelet, opened clasp, neutral background, at least 1600 px on the long side.',
    },
    { key: 'status', label: 'Status', kind: 'select', bulk: true, options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
    ], required: true },
  ],
}

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export function reporterLabel(r: CheckItem['reporter']): string {
  if (!r) return ''
  return r.name || r.email || r.id
}
