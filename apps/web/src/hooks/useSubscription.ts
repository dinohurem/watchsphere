import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';

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

export function useSubscription() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAdmin = useAuthStore((state) => state.isAdmin);
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

  // Computed properties - admin users always have full access
  const hasActiveSubscription = isAdmin || (subscription?.has_subscription ?? false);
  const isExpired = !isAdmin && !hasActiveSubscription && subscription !== null;
  const isTrial = !isAdmin && (subscription?.is_trial ?? false);
  const daysRemaining = isTrial
    ? subscription?.trial_days_remaining ?? 0
    : subscription?.subscription_days_remaining ?? 0;

  // Check if feature access is allowed (admin or has active subscription)
  const canAccessFeature = useCallback((feature: 'market' | 'orders' | 'home' | 'ai_chat' | 'chat' | 'conversations') => {
    // Admin users always have full access
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
  }, [isAdmin, hasActiveSubscription]);

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription,
    isExpired,
    isTrial,
    daysRemaining,
    canAccessFeature,
    refresh: loadSubscription,
  };
}
