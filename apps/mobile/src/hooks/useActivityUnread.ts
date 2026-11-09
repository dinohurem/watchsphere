import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuthStore } from '@watchsphere/shared/stores';

import { api } from '@/services/api';

export const ACTIVITY_UNREAD_KEY = ['activity', 'unread-count'] as const;

/** Unread alert-match count for the red badge on the Activity tab. */
export function useActivityUnread() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const approved = useAuthStore((s) => s.user?.approved);
  const query = useQuery({
    queryKey: ACTIVITY_UNREAD_KEY,
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count', {
        params: { type: 'alert_match' },
      });
      const n = Number(res.data?.count ?? res.data?.unread_count ?? 0);
      return Number.isFinite(n) ? n : 0;
    },
    enabled: isAuthenticated && approved !== false,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
  return query.data ?? 0;
}

/** Returns a function that refetches the Activity badge (after push, mark read, …). */
export function useRefreshActivityBadge() {
  const client = useQueryClient();
  return useCallback(() => {
    client.invalidateQueries({ queryKey: ACTIVITY_UNREAD_KEY });
  }, [client]);
}
