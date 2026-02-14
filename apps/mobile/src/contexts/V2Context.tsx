import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '@/services/api';

interface V2ContextType {
  v2Enabled: boolean;
  loading: boolean;
}

const V2Context = createContext<V2ContextType>({ v2Enabled: false, loading: true });

export function V2Provider({ children }: { children: React.ReactNode }) {
  const [v2Enabled, setV2Enabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings/app');
      setV2Enabled(res.data.v2_enabled);
    } catch {
      setV2Enabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Re-fetch when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchSettings();
      }
      appState.current = nextAppState;
    });
    return () => { sub.remove(); };
  }, [fetchSettings]);

  return (
    <V2Context.Provider value={{ v2Enabled, loading }}>
      {children}
    </V2Context.Provider>
  );
}

export const useV2 = () => useContext(V2Context);
