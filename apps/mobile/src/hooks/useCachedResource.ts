/**
 * Stale-while-revalidate list loading backed by AsyncStorage (spec 12, M5).
 *
 * - Cached content appears instantly and refreshes silently in the background.
 * - `showSkeleton` is true only while the local cache is empty and the first request runs
 *   (first open after login) – never on pull-to-refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'ws_cache:';

export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!key || !enabled) return;
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      setLoading(true);
      try {
        const next = await fetcherRef.current();
        if (id !== requestId.current) return;
        setData(next);
        setError(null);
        AsyncStorage.setItem(PREFIX + key, JSON.stringify(next)).catch(() => {});
      } catch (e) {
        if (id === requestId.current) setError(e);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key, enabled]
  );

  useEffect(() => {
    let cancelled = false;
    setCacheChecked(false);
    if (!key || !enabled) return;
    (async () => {
      const raw = await AsyncStorage.getItem(PREFIX + key).catch(() => null);
      if (cancelled) return;
      if (raw) {
        try {
          setData(JSON.parse(raw) as T);
        } catch {
          setData(undefined);
        }
      } else {
        setData(undefined);
      }
      setCacheChecked(true);
      load('initial');
    })();
    return () => {
      cancelled = true;
    };
  }, [key, enabled, load]);

  const reload = useCallback(() => load('silent'), [load]);
  const refresh = useCallback(() => load('refresh'), [load]);

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    /** Grey placeholders only while the cache is empty (first open). */
    showSkeleton: data === undefined && (!cacheChecked || loading) && enabled,
    reload,
    refresh,
  };
}

/** Remove every cached list (call on logout). */
export async function clearResourceCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}
