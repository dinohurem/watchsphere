import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';

// Admin users should never see paywalls

export interface SubscriptionStatus {
  has_subscription: boolean;
  status: string | null;
  plan: string | null;
  is_trial: boolean;
  trial_days_remaining: number;
  subscription_days_remaining: number;
  expires_at: string | null;
  price_monthly: number | null;
  currency: string | null;
  auto_renew: boolean | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  hasActiveSubscription: boolean;
  isExpired: boolean;
  isTrial: boolean;
  daysRemaining: number;
  canAccessFeature: (feature: 'market' | 'orders' | 'home' | 'ai_chat' | 'chat' | 'conversations') => boolean;
  refresh: () => Promise<void>;
  verifyAndRefresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { token, isAdmin } = useAuthStore();
  const isAuthenticated = !!token;
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/billing/subscription/status');
      setSubscription(response.data);
    } catch (err: any) {
      console.error('Failed to load subscription:', err);
      setError(err.response?.data?.detail || 'Failed to load subscription');
      // Set default expired state if can't load
      setSubscription({
        has_subscription: false,
        status: 'expired',
        plan: null,
        is_trial: false,
        trial_days_remaining: 0,
        subscription_days_remaining: 0,
        expires_at: null,
        price_monthly: null,
        currency: null,
        auto_renew: null,
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Computed properties
  // Admin users always have access (no paywalls)
  const hasActiveSubscription = isAdmin || (subscription?.has_subscription ?? false);
  const isExpired = !hasActiveSubscription && subscription !== null;
  const isTrial = subscription?.is_trial ?? false;
  const daysRemaining = isTrial
    ? subscription?.trial_days_remaining ?? 0
    : subscription?.subscription_days_remaining ?? 0;

  // Check if feature access is allowed (has active subscription or is admin)
  const canAccessFeature = useCallback((feature: 'market' | 'orders' | 'home' | 'ai_chat' | 'chat' | 'conversations') => {
    // Admin users always have access to all features
    if (isAdmin) {
      return true;
    }
    // Chat/conversations are always allowed
    if (feature === 'chat' || feature === 'conversations') {
      return true;
    }
    // AI chat requires subscription
    if (feature === 'ai_chat') {
      return hasActiveSubscription;
    }
    // Market, orders, home require subscription
    return hasActiveSubscription;
  }, [hasActiveSubscription, isAdmin]);

  // Verify payment and refresh subscription (called when returning from billing page)
  const verifyAndRefresh = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      // Try to verify any pending payment
      await api.post('/billing/subscription/verify');
    } catch (err: any) {
      // Ignore errors - payment might already be processed or no pending payment
      console.log('Verify subscription:', err.response?.data?.detail || 'No pending payment');
    }

    // Always refresh the subscription status
    await loadSubscription();
  }, [isAuthenticated, loadSubscription]);

  const value = useMemo(() => ({
    subscription,
    loading,
    error,
    hasActiveSubscription,
    isExpired,
    isTrial,
    daysRemaining,
    canAccessFeature,
    refresh: loadSubscription,
    verifyAndRefresh,
  }), [
    subscription,
    loading,
    error,
    hasActiveSubscription,
    isExpired,
    isTrial,
    daysRemaining,
    canAccessFeature,
    loadSubscription,
    verifyAndRefresh,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
