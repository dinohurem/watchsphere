/**
 * Number, price, percent and count formatting for the redesign (spec v3, section 0.1 / 0.4).
 *
 * - Dot as thousands separator, no decimals: 1.290.000
 * - Currency codes after the number with a space: "1.290.000 HKD"
 * - Symbols directly after the number: "100.000€", "90.000£", "110.000$"
 * - Percentages with a comma: "+4,2%"; 0 % is shown as "–"
 * - Counts from 1.000 upwards abbreviated with "k" and a decimal comma: 1.250 → "1,3k"
 */

export const SUPPORTED_CURRENCIES = [
  'EUR',
  'HKD',
  'AED',
  'GBP',
  'CHF',
  'USD',
  'CNY',
  'JPY',
  'SGD',
] as const;

export type AppCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_NAMES: Record<AppCurrency, string> = {
  EUR: 'Euro',
  HKD: 'Hong Kong dollar',
  AED: 'UAE dirham',
  GBP: 'British pound',
  CHF: 'Swiss franc',
  USD: 'US dollar',
  CNY: 'Chinese yuan',
  JPY: 'Japanese yen',
  SGD: 'Singapore dollar',
};

const SYMBOL_AFTER: Partial<Record<string, string>> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
};

export function isAppCurrency(value: unknown): value is AppCurrency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** 1290000 → "1.290.000" (rounded, no decimals). */
export function formatNumber(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return value < 0 && rounded !== 0 ? `-${digits}` : digits;
}

/** Price in a currency: "1.428.000 HKD", "168.100€". USDT is shown as USD. */
export function formatPrice(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  const code = (currency || '').toUpperCase() === 'USDT' ? 'USD' : (currency || '').toUpperCase();
  const symbol = SYMBOL_AFTER[code];
  return symbol ? `${formatNumber(value)}${symbol}` : `${formatNumber(value)} ${code}`;
}

/** Converted price line under the original: "≈ 168.100€". */
export function formatApprox(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return `≈ ${formatPrice(value, currency)}`;
}

/**
 * Percent with a decimal comma and explicit sign: 4.2 → "+4,2%", -2.3 → "−2,3%".
 * Returns "–" for 0 (or a value that rounds to 0,0) and for missing data.
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  if (rounded === 0) return '–';
  const body = Math.abs(rounded).toFixed(decimals).replace('.', ',');
  return `${rounded > 0 ? '+' : '−'}${body}%`;
}

/** Whole-number percent for the retail chip: 152.4 → "+152%". */
export function formatPercentWhole(value: number | null | undefined): string {
  return formatPercent(value, 0);
}

export type Trend = 'up' | 'down' | 'flat' | 'none';

export function trendOf(value: number | null | undefined, decimals = 1): Trend {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'none';
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  if (rounded > 0) return 'up';
  if (rounded < 0) return 'down';
  return 'flat';
}

/** All-time WTS/WTB counts: 980 → "980", 1250 → "1,3k", 1100 → "1,1k", 12000 → "12k". */
export function formatCount(value: number | null | undefined): string {
  const n = Math.max(0, Math.round(value ?? 0));
  if (n < 1000) return String(n);
  const k = Math.round(n / 100) / 10;
  const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace('.', ',');
  return `${text}k`;
}

/** Listing age tag: "4m", "1h", "12d". */
export function formatAge(dateIso: string | null | undefined, now: Date = new Date()): string {
  if (!dateIso) return '';
  const then = new Date(dateIso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Rates are "units of currency per 1 USD" (USD = 1), as returned by GET /fx/rates. */
export type FxRates = Record<string, number>;

export function convertAmount(
  amount: number | null | undefined,
  from: string,
  to: string,
  rates: FxRates | null | undefined
): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  const f = (from || '').toUpperCase() === 'USDT' ? 'USD' : (from || '').toUpperCase();
  const t = (to || '').toUpperCase() === 'USDT' ? 'USD' : (to || '').toUpperCase();
  if (f === t) return amount;
  if (!rates) return null;
  const rf = f === 'USD' ? 1 : rates[f];
  const rt = t === 'USD' ? 1 : rates[t];
  if (!rf || !rt) return null;
  return (amount / rf) * rt;
}

const EU_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** Initial currency from the iPhone region setting (spec 0.2). */
export function currencyForRegion(region: string | null | undefined): AppCurrency {
  const r = (region || '').toUpperCase();
  if (EU_REGIONS.has(r)) return 'EUR';
  switch (r) {
    case 'HK':
      return 'HKD';
    case 'AE':
      return 'AED';
    case 'GB':
    case 'UK':
      return 'GBP';
    case 'CH':
      return 'CHF';
    case 'US':
      return 'USD';
    case 'CN':
      return 'CNY';
    case 'JP':
      return 'JPY';
    case 'SG':
      return 'SGD';
    default:
      return 'USD';
  }
}

/** Emoji flag for an ISO-3166 alpha-2 code ("HK" → 🇭🇰). UK is mapped to GB. */
export function flagEmoji(countryCode: string | null | undefined): string {
  let cc = (countryCode || '').toUpperCase();
  if (cc === 'UK') cc = 'GB';
  if (cc === 'UAE') cc = 'AE';
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Short display names used next to flags (spec 0.1: UAE, UK, US). */
export function shortCountryName(countryCode: string, fallback?: string | null): string {
  const cc = countryCode.toUpperCase();
  if (cc === 'AE' || cc === 'UAE') return 'UAE';
  if (cc === 'GB' || cc === 'UK') return 'UK';
  if (cc === 'US') return 'US';
  return fallback || cc;
}
