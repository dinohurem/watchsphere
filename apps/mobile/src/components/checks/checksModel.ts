/**
 * Checks (spec addendum, section 1) – types, API calls and the small pieces of client-side logic
 * (which result card to show, dial codes, date / text formatting). Follows API_CONTRACT.md.
 */
import { api } from '@/services/api';

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type SerialReportType = 'stolen' | 'counterfeit' | 'frankenstein' | 'fake_papers';

export interface SerialMatch {
  id: string;
  type: SerialReportType;
  brand: string | null;
  model: string | null;
  reference: string | null;
  reported_at: string | null;
  location: string | null;
}

export interface SerialCheckResult {
  serial: string;
  serial_normalized: string;
  checked_at: string;
  matches: SerialMatch[];
}

export interface SerialReportDetail {
  id: string;
  type: SerialReportType;
  brand: string | null;
  model: string | null;
  reference: string | null;
  serial: string;
  how_stolen: string | null;
  how_stolen_label: string | null;
  date_of_incident: string | null;
  location: string | null;
  details: string | null;
  reported_at: string | null;
}

export type PhoneState = 'verified' | 'scammer' | 'none';

export interface PhoneCheckResult {
  e164: string;
  state: PhoneState;
  report_id: string | null;
  checked_at: string;
}

export interface DealerNumberDetail {
  id: string;
  e164: string;
  country_code: string;
  phone: string;
  country: string | null;
  details: string | null;
  reported_at: string | null;
}

export interface Bracelet {
  id: string;
  name: string;
  full_links: number | null;
  notes: string | null;
  photo_url: string | null;
  photo_thumb_url: string | null;
  sort_order: number;
}

export interface BraceletResult {
  query: string;
  reference: string;
  brand: string | null;
  model: string | null;
  in_catalogue: boolean;
  bracelets: Bracelet[];
}

export type ReportKind = 'stolen' | 'scammer' | 'counterfeit';

export interface SubmittedReport {
  id: string;
  kind: 'serial' | 'dealer_number';
  status: string;
  summary: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------------------------
// Result state logic
// ---------------------------------------------------------------------------------------------

export type SerialState =
  | 'clear'
  | 'stolen-single'
  | 'stolen-multi'
  | 'counterfeit'
  | 'fake-papers';

/**
 * Which CK2 card a serial response gets: any stolen match wins (single → CK2c, several → CK2b),
 * then counterfeit / Frankenstein (CK2e), then fake papers (CK2f), otherwise "No reports" (CK2).
 */
export function serialState(matches: SerialMatch[] | undefined | null): SerialState {
  const list = matches ?? [];
  if (list.length === 0) return 'clear';
  const stolen = list.filter((m) => m.type === 'stolen');
  if (stolen.length > 1) return 'stolen-multi';
  if (stolen.length === 1) return 'stolen-single';
  if (list.some((m) => m.type === 'counterfeit' || m.type === 'frankenstein')) return 'counterfeit';
  return 'fake-papers';
}

/** Matches listed under the CK2b card (the stolen ones). */
export function stolenMatches(matches: SerialMatch[]): SerialMatch[] {
  return matches.filter((m) => m.type === 'stolen');
}

/** The match the "View report" link of CK2c / CK2e / CK2f opens. */
export function primaryMatch(matches: SerialMatch[]): SerialMatch | undefined {
  return (
    matches.find((m) => m.type === 'stolen') ??
    matches.find((m) => m.type === 'counterfeit' || m.type === 'frankenstein') ??
    matches[0]
  );
}

/** What the bracelet screen shows for a response. */
export type BraceletState = 'cards' | 'no-data';
export function braceletState(result: BraceletResult | undefined | null): BraceletState {
  return result && result.bracelets.length > 0 ? 'cards' : 'no-data';
}

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value: string): Date | null {
  // Plain dates are local days; datetimes without a zone are UTC (backend sends naive UTC).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-11-08" or an ISO datetime → "8 Nov 2026". */
export function formatDay(value: string | null | undefined): string {
  const d = value ? parseDate(value) : null;
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** ISO datetime → "8 Nov 2026, 10:42". */
export function formatDayTime(value: string | null | undefined): string {
  const d = value ? parseDate(value) : null;
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDay(value)}, ${hh}:${mm}`;
}

/** Date → "YYYY-MM-DD" (local). */
export function toIsoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Richard Mille RM 035 · 605" style row title. */
export function matchTitle(m: Pick<SerialMatch, 'brand' | 'model' | 'reference'>): string {
  const name = [m.brand, m.model].filter(Boolean).join(' ');
  return [name, m.reference].filter(Boolean).join(' · ') || 'Reported watch';
}

/** "+852", "61234567" → "+852 6123 4567". */
export function displayNumber(countryCode: string, phone: string): string {
  const national = phone.replace(/\D/g, '');
  const grouped = national.replace(/(\d{4})(?=\d)/g, '$1 ');
  return `${countryCode} ${grouped}`.trim();
}

// ---------------------------------------------------------------------------------------------
// Dial codes (country-code button, CK3 / CK4b)
// ---------------------------------------------------------------------------------------------

export interface DialCountry {
  code: string;
  name: string;
  dial: string;
}

export const DIAL_CODES: DialCountry[] = [
  { code: 'HK', name: 'Hong Kong', dial: '+852' },
  { code: 'AE', name: 'UAE', dial: '+971' },
  { code: 'GB', name: 'UK', dial: '+44' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'BH', name: 'Bahrain', dial: '+973' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dial: '+387' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'BG', name: 'Bulgaria', dial: '+359' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'HR', name: 'Croatia', dial: '+385' },
  { code: 'CY', name: 'Cyprus', dial: '+357' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'EG', name: 'Egypt', dial: '+20' },
  { code: 'FI', name: 'Finland', dial: '+358' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'GR', name: 'Greece', dial: '+30' },
  { code: 'HU', name: 'Hungary', dial: '+36' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'IL', name: 'Israel', dial: '+972' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'JO', name: 'Jordan', dial: '+962' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7' },
  { code: 'KW', name: 'Kuwait', dial: '+965' },
  { code: 'LB', name: 'Lebanon', dial: '+961' },
  { code: 'LU', name: 'Luxembourg', dial: '+352' },
  { code: 'MO', name: 'Macau', dial: '+853' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'MT', name: 'Malta', dial: '+356' },
  { code: 'MX', name: 'Mexico', dial: '+52' },
  { code: 'MC', name: 'Monaco', dial: '+377' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'OM', name: 'Oman', dial: '+968' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'QA', name: 'Qatar', dial: '+974' },
  { code: 'RO', name: 'Romania', dial: '+40' },
  { code: 'RU', name: 'Russia', dial: '+7' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { code: 'RS', name: 'Serbia', dial: '+381' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'SK', name: 'Slovakia', dial: '+421' },
  { code: 'SI', name: 'Slovenia', dial: '+386' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'KR', name: 'South Korea', dial: '+82' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'TW', name: 'Taiwan', dial: '+886' },
  { code: 'TH', name: 'Thailand', dial: '+66' },
  { code: 'TR', name: 'Turkey', dial: '+90' },
  { code: 'UA', name: 'Ukraine', dial: '+380' },
  { code: 'VN', name: 'Vietnam', dial: '+84' },
];

export function dialCountry(code: string): DialCountry {
  return DIAL_CODES.find((c) => c.code === code) ?? DIAL_CODES[0];
}

/**
 * The user's country, preset in the country-code button: the dial code of their saved WhatsApp
 * number when there is one, else the device region, else Hong Kong (the app's home market).
 */
export function defaultDialCountry(whatsapp?: string | null, region?: string | null): DialCountry {
  const raw = (whatsapp || '').replace(/[^\d+]/g, '');
  if (raw.startsWith('+') || raw.startsWith('00')) {
    const normalised = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
    // Longest dial code wins.
    const hit = [...DIAL_CODES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => normalised.startsWith(c.dial));
    if (hit) return hit;
  }
  const byRegion = region ? DIAL_CODES.find((c) => c.code === region.toUpperCase()) : undefined;
  return byRegion ?? DIAL_CODES[0];
}

/** Region of the device locale ("en-HK" → "HK"), if it has one. */
export function deviceRegion(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const m = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(locale);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------

export function errorMessage(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}

export function errorStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status;
}

export async function checkSerial(serial: string): Promise<SerialCheckResult> {
  const res = await api.get('/checks/serial', { params: { serial } });
  return res.data;
}

export async function fetchSerialReport(id: string): Promise<SerialReportDetail> {
  const res = await api.get(`/checks/serial-reports/${id}`);
  return res.data;
}

export async function checkPhone(countryCode: string, number: string): Promise<PhoneCheckResult> {
  const res = await api.get('/checks/phone', { params: { country_code: countryCode, number } });
  return res.data;
}

export async function fetchDealerNumber(id: string): Promise<DealerNumberDetail> {
  const res = await api.get(`/checks/dealer-numbers/${id}`);
  return res.data;
}

export async function checkBracelets(reference: string): Promise<BraceletResult> {
  const res = await api.get('/checks/bracelets', { params: { reference } });
  return res.data;
}

export async function fetchChecksConfig(): Promise<{ support_whatsapp?: string }> {
  const res = await api.get('/checks/config');
  return res.data;
}

export async function uploadReportPhoto(uri: string): Promise<string | null> {
  const body = new FormData();
  const filename = uri.split('/').pop() || 'photo.jpg';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body.append('file', { uri, type: 'image/jpeg', name: filename } as any);
  const res = await api.post('/upload/watch', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.url ?? null;
}

export async function submitReport(
  kind: ReportKind,
  payload: Record<string, unknown>
): Promise<SubmittedReport> {
  const res = await api.post(`/checks/reports/${kind}`, payload);
  return res.data;
}
