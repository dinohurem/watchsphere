/**
 * Shared types and constants for the watch detail page redesign (spec v3, sections 1–3).
 * Response shapes follow the "Public API for mobile" contract in
 * docs/plans/2026-11-08-nov-specs-plan.md.
 */

export type DetailPeriod = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const DETAIL_PERIODS: { value: DetailPeriod; label: string; long: string }[] = [
  { value: '1W', label: '1W', long: '1 week' },
  { value: '1M', label: '1M', long: '1 month' },
  { value: '3M', label: '3M', long: '3 months' },
  { value: '1Y', label: '1Y', long: '1 year' },
  { value: 'ALL', label: 'All', long: 'All time' },
];

export const PERIOD_DAYS: Record<DetailPeriod, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: null,
};

export function periodLabel(period: DetailPeriod): string {
  return DETAIL_PERIODS.find((p) => p.value === period)?.label ?? period;
}

export type SortMode = 'cheapest' | 'newest';

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  median: number;
}

export interface TrendSeries {
  median: number | null;
  change_pct: number | null;
  count: number;
  series: TrendPoint[];
}

/** GET /market/detail/{ws_code}/trend?period=&currency= */
export interface PriceTrend {
  period: string;
  currency: string;
  enough_data: boolean;
  wts_change_pct: number | null;
  fresh: TrendSeries;
  used: TrendSeries;
}

export interface RetailCountry {
  code: string;
  name: string;
  tax_label: string;
  list_currency: string;
  list_price: number | null;
  list_price_converted: number | null;
  vs_retail_pct: number | null;
  status: 'ok' | 'no_data' | 'discontinued';
}

/** GET /market/detail/{ws_code}/retail?currency= */
export interface RetailComparison {
  status: 'ok' | 'discontinued' | 'no_data';
  currency: string;
  fresh_median: number | null;
  avg_vs_retail_pct: number | null;
  countries: RetailCountry[];
}

/** Request state for the trend / retail endpoints. `unavailable` = endpoint 404/501 (B3). */
export type LoadState = 'idle' | 'loading' | 'ok' | 'error' | 'unavailable';

export function isUnavailableError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 501;
}

/** Palette from spec 0.1 – no new colours. */
export const DETAIL_COLORS = {
  text: '#1C1C1E',
  grey: '#8E8E93',
  greyLight: '#AEAEB2',
  chip: '#E9E9EB',
  chipLight: '#EFEFF1',
  rowAlt: '#F2F2F4',
  green: '#34C759',
  greenText: '#2FA84F',
  greenLight: '#E3F5E8',
  red: '#FF3B30',
  redText: '#D70015',
  redLight: '#FDE8E7',
  blue: '#3478F6',
  blueLight: '#E4EEFB',
  border: '#ECECEF',
};
