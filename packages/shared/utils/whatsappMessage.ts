/**
 * Default WhatsApp text for the chat button on an order. Always English (never translated);
 * the user can still edit it in WhatsApp before sending.
 *
 *   WTS: "Hi, is the 126500LN White 2026 276,000 HKD still available?"
 *   WTB: "Hi, I have a 126500LN White available. Are you still looking?"
 */

export interface WhatsAppOrderInfo {
  /** "sell" / "buy" (also accepts "wts" / "wtb", any case). Defaults to sell. */
  orderType?: string | null;
  wsCode?: string | null;
  /** Fallback when the order has no ws_code. */
  reference?: string | null;
  /** Number (2026) or string ("2026", "11/2026", "2026+"). Ranges / invalid values are omitted. */
  year?: number | string | null;
  price?: number | null;
  /** The order's own currency (not the user's display currency). */
  currency?: string | null;
}

/** 4-digit year from a number or a "2026" / "11/2026" / "2026+" string; undefined otherwise. */
export function extractYear(year: number | string | null | undefined): string | undefined {
  if (year == null) return undefined;
  const text = String(year).trim();
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length !== 1) return undefined; // none, or a range
  if (/\b(19|20)\d{2}\s*[-–—]\s*\d/.test(text)) return undefined; // "2020-22"
  return matches[0];
}

/** 276000 -> "276,000" (comma thousands separator, independent of the device locale). */
export function formatWhatsAppPrice(price: number): string {
  const [int, dec] = String(Math.round(price * 100) / 100).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${grouped}.${dec.padEnd(2, '0')}` : grouped;
}

export function buildWhatsAppOrderMessage(order: WhatsAppOrderInfo): string {
  const code = (order.wsCode || order.reference || '').trim();
  const type = (order.orderType || 'sell').toLowerCase();

  if (type === 'buy' || type === 'wtb') {
    return ['Hi, I have a', code, 'available. Are you still looking?'].filter(Boolean).join(' ');
  }

  const year = extractYear(order.year);
  const hasPrice = typeof order.price === 'number' && isFinite(order.price) && order.price > 0;
  const price = hasPrice
    ? [formatWhatsAppPrice(order.price as number), (order.currency || '').trim()]
        .filter(Boolean)
        .join(' ')
    : '';
  return ['Hi, is the', code, year, price, 'still available?'].filter(Boolean).join(' ');
}

/** Builds the https://wa.me link with the message prefilled. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
}
