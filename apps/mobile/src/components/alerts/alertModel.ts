/**
 * Watch alerts (spec v3, section 8) – model, labels and API calls.
 * Shape follows the `/watch-alerts` contract in docs/plans/2026-11-08-nov-specs-plan.md.
 */
import { api } from '@/services/api';
import { flagEmoji, formatPrice } from '@/utils/marketFormat';

export type AlertType = 'wts' | 'wtb';
export type YearMode = 'any' | 'newer' | 'exactly' | 'older';
export type AlertCondition = 'any' | 'unworn' | 'used';
export type PriceMode = 'any' | 'max' | 'min';

export interface WatchAlert {
  id: string;
  ws_code: string;
  alert_type: AlertType;
  year_mode: YearMode;
  year: number | null;
  month: number | null;
  condition: AlertCondition;
  /** ISO country codes; "EU" allowed; empty = worldwide. */
  locations: string[];
  price_mode: PriceMode;
  price_amount: number | null;
  currency: string;
  brand?: string | null;
  model?: string | null;
  reference?: string | null;
  created_at?: string;
}

export type AlertDraft = Omit<WatchAlert, 'id' | 'created_at' | 'brand' | 'model' | 'reference'>;

export function defaultDraft(wsCode: string, type: AlertType, currency: string): AlertDraft {
  return {
    ws_code: wsCode,
    alert_type: type,
    year_mode: 'any',
    year: null,
    month: null,
    condition: 'any',
    locations: [],
    price_mode: 'any',
    price_amount: null,
    currency,
  };
}

export function draftFromAlert(alert: WatchAlert): AlertDraft {
  return {
    ws_code: alert.ws_code,
    alert_type: alert.alert_type,
    year_mode: alert.year_mode || 'any',
    year: alert.year ?? null,
    month: alert.month ?? null,
    condition: alert.condition || 'any',
    locations: alert.locations || [],
    price_mode: alert.price_mode || 'any',
    price_amount: alert.price_amount ?? null,
    currency: alert.currency || 'EUR',
  };
}

/** Normalises a draft before saving: drops values that do not apply to the chosen modes. */
export function payloadFromDraft(draft: AlertDraft): AlertDraft {
  const yearSet = draft.year_mode !== 'any' && draft.year !== null;
  const priceMode: PriceMode =
    draft.price_mode === 'any' || draft.price_amount === null || !(draft.price_amount > 0)
      ? 'any'
      : draft.alert_type === 'wts'
        ? 'max'
        : 'min';
  return {
    ...draft,
    year_mode: yearSet ? draft.year_mode : 'any',
    year: yearSet ? draft.year : null,
    month: yearSet ? draft.month : null,
    price_mode: priceMode,
    price_amount: priceMode === 'any' ? null : draft.price_amount,
  };
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

function yearText(year: number, month: number | null): string {
  return month ? `${String(month).padStart(2, '0')}/${year}` : String(year);
}

/** Row value / summary: "Any", "2022+", "11/2026", "Older than 2020". */
export function yearValueLabel(draft: Pick<AlertDraft, 'year_mode' | 'year' | 'month'>): string {
  if (draft.year_mode === 'any' || draft.year === null) return 'Any';
  const text = yearText(draft.year, draft.month);
  if (draft.year_mode === 'newer') return `${text}+`;
  if (draft.year_mode === 'older') return `Older than ${text}`;
  return text;
}

export function conditionValueLabel(condition: AlertCondition): string {
  if (condition === 'unworn') return 'Only unworn';
  if (condition === 'used') return 'Only used';
  return 'Any';
}

export const LOCATION_NAMES: Record<string, string> = {
  EU: 'EU',
  HK: 'Hong Kong',
  AE: 'United Arab Emirates',
  GB: 'United Kingdom',
  US: 'United States',
  CH: 'Switzerland',
  CN: 'China',
};

/** Short names for summaries (spec 0.1: UAE, UK, US). */
const SHORT_LOCATION: Record<string, string> = { AE: 'UAE', GB: 'UK', US: 'US' };

export function locationValueLabel(locations: string[], countryName?: (code: string) => string): string {
  if (!locations || locations.length === 0) return 'Worldwide';
  return locations
    .map((code) => SHORT_LOCATION[code] || LOCATION_NAMES[code] || countryName?.(code) || code)
    .join(', ');
}

export function priceValueLabel(
  draft: Pick<AlertDraft, 'alert_type' | 'price_mode' | 'price_amount' | 'currency'>
): string {
  const set = draft.price_mode !== 'any' && draft.price_amount !== null && draft.price_amount > 0;
  if (draft.alert_type === 'wtb') {
    return set ? `Target ≥ ${formatPrice(draft.price_amount, draft.currency)}` : 'Every WTB';
  }
  return set ? `Up to ${formatPrice(draft.price_amount, draft.currency)}` : 'Any price';
}

/** AL8 row title: "2022+ · Only unworn" / "Any year · Any condition". */
export function alertTitle(alert: AlertDraft): string {
  const year = yearValueLabel(alert);
  const cond = conditionValueLabel(alert.condition);
  return `${year === 'Any' ? 'Any year' : year} · ${cond === 'Any' ? 'Any condition' : cond}`;
}

/** AL8 row subtitle: "EU, Hong Kong · Up to 150.000€". */
export function alertSubtitle(alert: AlertDraft, countryName?: (code: string) => string): string {
  return `${locationValueLabel(alert.locations, countryName)} · ${priceValueLabel(alert)}`;
}

export function locationFlag(code: string): string {
  return code === 'EU' ? '🇪🇺' : flagEmoji(code);
}

// ---------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------

function normalise(raw: unknown): WatchAlert | null {
  const a = raw as Partial<WatchAlert> & { _id?: string };
  const id = a?.id || a?._id;
  if (!id || !a.ws_code) return null;
  return {
    id,
    ws_code: a.ws_code,
    alert_type: a.alert_type === 'wtb' ? 'wtb' : 'wts',
    year_mode: (a.year_mode as YearMode) || 'any',
    year: a.year ?? null,
    month: a.month ?? null,
    condition: (a.condition as AlertCondition) || 'any',
    // The server stores the UK as "UK"; the pickers use ISO "GB".
    locations: Array.isArray(a.locations)
      ? a.locations.map((c) => (String(c).toUpperCase() === 'UK' ? 'GB' : c))
      : [],
    price_mode: (a.price_mode as PriceMode) || 'any',
    price_amount: a.price_amount ?? null,
    currency: a.currency || 'EUR',
    brand: a.brand ?? null,
    model: a.model ?? null,
    reference: a.reference ?? null,
    created_at: a.created_at,
  };
}

function normaliseList(data: unknown): WatchAlert[] {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];
  return list.map(normalise).filter((a): a is WatchAlert => a !== null);
}

/** GET /watch-alerts – all alerts of the user, newest first. */
export async function fetchAllAlerts(): Promise<WatchAlert[]> {
  const res = await api.get('/watch-alerts');
  return normaliseList(res.data);
}

/** GET /watch-alerts/{ws_code} */
export async function fetchAlertsForWatch(wsCode: string): Promise<WatchAlert[]> {
  const res = await api.get(`/watch-alerts/${encodeURIComponent(wsCode)}`);
  return normaliseList(res.data);
}

/** POST /watch-alerts or PUT /watch-alerts/{id} */
export async function saveAlert(draft: AlertDraft, id?: string | null): Promise<void> {
  const payload = payloadFromDraft(draft);
  if (id) await api.put(`/watch-alerts/${encodeURIComponent(id)}`, payload);
  else await api.post('/watch-alerts', payload);
}

/** DELETE /watch-alerts/{id} */
export async function deleteAlert(id: string): Promise<void> {
  await api.delete(`/watch-alerts/${encodeURIComponent(id)}`);
}
