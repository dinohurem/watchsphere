import { useEffect } from 'react';

import { api } from '@/services/api';

/**
 * Records a watch in the user's "Recently viewed" list (Home H1) when a detail page opens.
 * Call once at the top of the detail page with the watch's WS code:
 *
 *   useTrackRecentlyViewed(watch?.ws_code);
 *
 * POST /profile/recently-viewed {ws_code}; fires once per WS code per mount, failures are silent.
 */
export function useTrackRecentlyViewed(wsCode: string | null | undefined) {
  useEffect(() => {
    if (!wsCode) return;
    api.post('/profile/recently-viewed', { ws_code: wsCode }).catch(() => {});
  }, [wsCode]);
}
