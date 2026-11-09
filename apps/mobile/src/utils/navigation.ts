import { router } from 'expo-router';

export interface OpenWatchDetailArgs {
  /** Watch document id; falls back to the WS code. */
  id?: string | null;
  wsCode?: string | null;
  reference?: string | null;
  brand?: string | null;
  model?: string | null;
  /** Order ids to highlight in the listing table (opened from push / Activity, spec N2 / M4). */
  highlight?: string[];
  /** WTS or WTB side to open on when highlighting. */
  side?: 'wts' | 'wtb';
}

/** Single entry point to the watch detail page (app/market/[id].tsx). */
export function openWatchDetail(args: OpenWatchDetailArgs) {
  const id = args.id || args.wsCode || args.reference;
  if (!id) return;
  const params: Record<string, string> = { id };
  if (args.wsCode) params.ws_code = args.wsCode;
  if (args.reference) params.reference = args.reference;
  if (args.brand) params.brand = args.brand;
  if (args.model) params.model = args.model;
  if (args.highlight && args.highlight.length > 0) params.highlight = args.highlight.join(',');
  if (args.side) params.side = args.side;
  router.push({ pathname: '/market/[id]', params } as never);
}
