/**
 * One currency setting for the whole app (redesign spec v3, section 0.2).
 *
 * - Stored on the user account (`preferred_currency`, synced across devices) and cached locally.
 * - Initial value comes from the iPhone region setting, not GPS.
 * - Exchange rates come from the backend's central rate table (GET /fx/rates), so the app
 *   converts with exactly the same numbers as the server-side medians.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '@watchsphere/shared/stores';

import { api } from '@/services/api';
import {
  AppCurrency,
  FxRates,
  convertAmount,
  currencyForRegion,
  isAppCurrency,
} from '@/utils/marketFormat';

const STORAGE_KEY = 'app_currency';
const RATES_KEY = 'fx_rates_cache';

interface CurrencyContextValue {
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => Promise<void>;
  rates: FxRates | null;
  /** Convert an amount from any currency into `to` (defaults to the app currency). */
  convert: (amount: number | null | undefined, from: string, to?: string) => number | null;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function deviceRegion(): string | null {
  try {
    let locale: string | undefined;
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier;
    }
    if (!locale) locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const match = /[-_]([A-Za-z]{2})(?:$|[-_@])/.exec(locale || '');
    return match ? match[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<AppCurrency>(() =>
    currencyForRegion(deviceRegion())
  );
  const [rates, setRates] = useState<FxRates | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const refreshRates = useCallback(async () => {
    try {
      const res = await api.get('/fx/rates');
      const next: FxRates | undefined = res.data?.rates;
      if (next && typeof next === 'object') {
        setRates(next);
        AsyncStorage.setItem(RATES_KEY, JSON.stringify(next)).catch(() => {});
      }
    } catch {
      // keep cached rates
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, cachedRates] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
        AsyncStorage.getItem(RATES_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      if (isAppCurrency(stored)) setCurrencyState(stored);
      if (cachedRates) {
        try {
          setRates(JSON.parse(cachedRates));
        } catch {
          // ignore corrupt cache
        }
      }
      // The account value wins over the local cache (synced across devices).
      if (!isAuthenticated) return;
      try {
        const me = await api.get('/profile/me');
        const remote = me.data?.preferred_currency;
        if (!cancelled && isAppCurrency(remote)) {
          setCurrencyState(remote);
          AsyncStorage.setItem(STORAGE_KEY, remote).catch(() => {});
        } else if (!cancelled && !remote && !isAppCurrency(stored)) {
          // First run on this account: persist the region default so other devices get it.
          const initial = currencyForRegion(deviceRegion());
          api.patch('/profile/me', { preferred_currency: initial }).catch(() => {});
        }
      } catch {
        // not logged in yet / offline – local value stays
      }
    })();
    if (isAuthenticated) refreshRates();
    return () => {
      cancelled = true;
    };
  }, [refreshRates, isAuthenticated]);

  const setCurrency = useCallback(async (next: AppCurrency) => {
    setCurrencyState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    try {
      await api.patch('/profile/me', { preferred_currency: next });
    } catch {
      // stays local until the next successful sync
    }
  }, []);

  const convert = useCallback(
    (amount: number | null | undefined, from: string, to?: string) =>
      convertAmount(amount, from, to ?? currency, rates),
    [currency, rates]
  );

  const value = useMemo(
    () => ({ currency, setCurrency, rates, convert, refreshRates }),
    [currency, setCurrency, rates, convert, refreshRates]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}
