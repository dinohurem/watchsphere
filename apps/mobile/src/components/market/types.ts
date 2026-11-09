/** Card shape shared by Market, Watchlist, Recently viewed and Search (API contract). */
export interface MarketCardData {
  id: string;
  ws_code: string | null;
  brand: string;
  model: string;
  reference: string;
  collection: string | null;
  image: string | null;
  thumbnail: string | null;
  change_1m_pct: number | null;
  wts_count: number;
  wtb_count: number;
  retail_pct: number | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCard(raw: any): MarketCardData {
  return {
    id: str(raw?.id ?? raw?._id ?? raw?.ws_code ?? raw?.reference),
    ws_code: raw?.ws_code ? str(raw.ws_code) : null,
    brand: str(raw?.brand),
    model: str(raw?.model),
    reference: str(raw?.reference),
    collection: raw?.collection ? str(raw.collection) : null,
    image: raw?.image || raw?.image_url || null,
    thumbnail: raw?.thumbnail || raw?.thumbnail_url || null,
    change_1m_pct: num(raw?.change_1m_pct),
    wts_count: num(raw?.wts_count) ?? 0,
    wtb_count: num(raw?.wtb_count) ?? 0,
    retail_pct: num(raw?.retail_pct),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCards(payload: any): MarketCardData[] {
  const list = Array.isArray(payload) ? payload : payload?.items;
  return Array.isArray(list) ? list.map(toCard) : [];
}

/** Watchlist items carry watchlist-record ids; the detail page is keyed by WS code / reference. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function watchlistToCards(payload: any): MarketCardData[] {
  return toCards(payload).map((card) => ({
    ...card,
    id: card.ws_code || card.reference || card.id,
  }));
}
