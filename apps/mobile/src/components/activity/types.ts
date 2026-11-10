/** Activity entry (GET /notifications?type=alert_match) – see API contract. */
export interface AlertMatchData {
  kind: 'wts' | 'wtb';
  ws_code: string | null;
  reference: string;
  brand: string | null;
  model: string | null;
  thumbnail: string | null;
  country_code: string | null;
  country_name: string | null;
  year: number | null;
  year_plus: boolean;
  condition: string | null;
  price: number | null;
  currency: string | null;
  order_ids: string[];
  count: number;
  dealer_phone: string | null;
  watch_id: string | null;
}

export interface ActivityEntry {
  id: string;
  read: boolean;
  created_at: string;
  data: AlertMatchData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrderIds(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string')
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toActivityEntry(raw: any): ActivityEntry {
  const d = raw?.data ?? {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    id: String(raw?.id ?? ''),
    read: Boolean(raw?.read ?? raw?.is_read ?? false),
    created_at: String(raw?.created_at ?? ''),
    data: {
      kind: d.kind === 'wtb' ? 'wtb' : 'wts',
      ws_code: d.ws_code ?? null,
      reference: String(d.reference ?? raw?.reference ?? ''),
      brand: d.brand ?? null,
      model: d.model ?? null,
      thumbnail: d.thumbnail ?? null,
      country_code: d.country_code ?? null,
      country_name: d.country_name ?? null,
      year: num(d.year),
      year_plus: Boolean(d.year_plus),
      condition: d.condition ?? null,
      price: num(d.price ?? raw?.price),
      currency: d.currency ?? raw?.currency ?? null,
      order_ids: toOrderIds(d.order_ids ?? raw?.order_id),
      count: num(d.count) ?? 1,
      dealer_phone: d.dealer_phone ?? null,
      watch_id: d.watch_id ?? null,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toActivityEntries(payload: any): ActivityEntry[] {
  const list = Array.isArray(payload) ? payload : (payload?.notifications ?? payload?.items ?? []);
  return Array.isArray(list)
    ? list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((n: any) => !n?.type || n.type === 'alert_match')
        .map(toActivityEntry)
    : [];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "Today", "Yesterday", then "6 November" (with year when not the current year). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function groupByDay(
  entries: ActivityEntry[]
): Array<{ title: string; data: ActivityEntry[] }> {
  const groups: Array<{ title: string; data: ActivityEntry[] }> = [];
  for (const entry of entries) {
    const title = dayLabel(entry.created_at);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.data.push(entry);
    else groups.push({ title, data: [entry] });
  }
  return groups;
}
