import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';

interface V2ContextType {
  v2Enabled: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const V2Context = createContext<V2ContextType>({ v2Enabled: false, loading: true, refetch: async () => {} });

export function V2Provider({ children }: { children: React.ReactNode }) {
  const [v2Enabled, setV2Enabled] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <V2Context.Provider value={{ v2Enabled, loading, refetch: fetchSettings }}>
      {children}
    </V2Context.Provider>
  );
}

export const useV2 = () => useContext(V2Context);
