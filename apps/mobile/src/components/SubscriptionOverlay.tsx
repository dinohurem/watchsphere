import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, AppState, AppStateStatus } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { router } from 'expo-router';
import { Crown, ExternalLink, ChevronLeft } from './icons';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { API_CONFIG } from '@/constants/api';
import { api } from '@/services/api';

// Generate a handoff URL with authentication token
const getHandoffUrl = async (redirectTo: string = 'billing'): Promise<string> => {
  try {
    // Request a one-time handoff token from the API
    const response = await api.post('/auth/mobile-handoff', { redirect_to: redirectTo });
    const { redirect_url } = response.data;
    // Return full URL with handoff token
    return `${API_CONFIG.webURL}${redirect_url}`;
  } catch (error) {
    console.error('Failed to get handoff token:', error);
    // Fallback to direct billing URL (user will need to login manually)
    return `${API_CONFIG.webURL}/app/profile/billing`;
  }
};

interface SubscriptionOverlayProps {
  children: React.ReactNode;
  feature?: 'market' | 'orders' | 'home' | 'ai_chat' | 'chat' | 'conversations';
  showOverlay?: boolean;
  showBackButton?: boolean;
  header?: React.ReactNode;
  /** Use compact mode for inline sections (positions overlay near top, not centered) */
  compact?: boolean;
}

export function SubscriptionOverlay({ children, feature = 'market', showOverlay, showBackButton = false, header, compact = false }: SubscriptionOverlayProps) {
  const { fonts } = useTheme();
  const { canAccessFeature, loading, isTrial, daysRemaining, verifyAndRefresh } = useSubscription();
  const appState = useRef(AppState.currentState);
  const hasOpenedBilling = useRef(false);

  // Listen for app state changes to verify subscription when returning from billing
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app comes back to foreground after opening billing
      if (appState.current.match(/inactive|background/) && nextAppState === 'active' && hasOpenedBilling.current) {
        hasOpenedBilling.current = false;
        // Verify and refresh subscription status
        verifyAndRefresh();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [verifyAndRefresh]);

  // If explicitly told to show overlay or feature is not accessible
  const shouldShowOverlay = showOverlay ?? !canAccessFeature(feature);

  // If no overlay needed (has subscription/trial or loading), show content with header normally
  if (loading || !shouldShowOverlay) {
    // If there's a header, render it above children
    if (header) {
      return (
        <View style={{ flex: 1 }}>
          {header}
          {children}
        </View>
      );
    }
    return <>{children}</>;
  }

  const handleOpenBilling = async () => {
    try {
      // Mark that we're opening billing
      hasOpenedBilling.current = true;
      // Get handoff URL with authentication token
      const webUrl = await getHandoffUrl('billing');
      const canOpen = await Linking.canOpenURL(webUrl);
      if (canOpen) {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Failed to open billing URL:', error);
      hasOpenedBilling.current = false;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      position: 'relative',
    },
    blurredContent: {
      flex: 1,
      opacity: 0.3,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: compact ? 'flex-start' : 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      paddingTop: compact ? hp(24) : 0,
    },
    overlayContent: {
      backgroundColor: '#FFFFFF',
      borderRadius: sp(24),
      padding: wp(24),
      marginHorizontal: wp(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
      alignItems: 'center',
      maxWidth: 400,
    },
    iconContainer: {
      width: sp(72),
      height: sp(72),
      borderRadius: sp(36),
      backgroundColor: '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(20),
    },
    title: {
      fontSize: fp(22),
      fontFamily: fonts.bold,
      color: '#1D1D1F',
      textAlign: 'center',
      marginBottom: hp(12),
    },
    description: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      lineHeight: fp(22),
      marginBottom: hp(24),
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#212121',
      borderRadius: sp(99),
      paddingVertical: hp(14),
      paddingHorizontal: wp(24),
      width: '100%',
      gap: wp(8),
    },
    buttonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    priceText: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
      textAlign: 'center',
      marginTop: hp(12),
    },
    webNote: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.4)',
      textAlign: 'center',
      marginTop: hp(8),
    },
    backButton: {
      position: 'absolute',
      top: hp(60),
      left: wp(16),
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      zIndex: 10,
    },
    headerContainer: {
      zIndex: 10,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header - always accessible, rendered above overlay */}
      {header && (
        <View style={styles.headerContainer}>
          {header}
        </View>
      )}

      {/* Back button - always accessible */}
      {showBackButton && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#212121" />
        </TouchableOpacity>
      )}

      {/* Content area with overlay */}
      <View style={{ flex: 1 }}>
        {/* Blurred content */}
        <View style={styles.blurredContent} pointerEvents="none">
          {children}
        </View>

        {/* Overlay - only covers content area, not header */}
        <View style={[styles.overlay, (header || showBackButton) ? { top: 0 } : null]} pointerEvents="box-none">
          <View style={styles.overlayContent}>
            <View style={styles.iconContainer}>
              <Crown size={36} color="#F59E0B" />
            </View>

            <Text style={styles.title}>
              {isTrial && daysRemaining > 0
                ? 'Your Trial is Ending Soon'
                : 'Subscription Required'}
            </Text>

            <Text style={styles.description}>
              {isTrial && daysRemaining > 0
                ? `You have ${daysRemaining} days left in your trial. Upgrade now to continue accessing all features.`
                : 'Your subscription has expired. Upgrade to Premium to unlock access to the market, orders, and AI assistant.'}
            </Text>

            <TouchableOpacity style={styles.button} onPress={handleOpenBilling}>
              <Crown size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Upgrade to Premium</Text>
              <ExternalLink size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.priceText}>Cancel anytime</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Loading screen while checking subscription
export function SubscriptionLoadingScreen() {
  const { fonts } = useTheme();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <LoadingAnimation />
      <Text style={{ marginTop: hp(16), fontFamily: fonts.medium, color: '#212121' }}>
        Checking subscription...
      </Text>
    </View>
  );
}

// Locked section overlay for individual sections (e.g., on Profile page)
interface LockedSectionProps {
  children: React.ReactNode;
  message?: string;
}

export function LockedSection({ children, message = 'Premium feature' }: LockedSectionProps) {
  const { fonts } = useTheme();
  const { hasActiveSubscription, loading, verifyAndRefresh } = useSubscription();
  const appState = useRef(AppState.currentState);
  const hasOpenedBilling = useRef(false);

  // Listen for app state changes to verify subscription when returning from billing
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app comes back to foreground after opening billing
      if (appState.current.match(/inactive|background/) && nextAppState === 'active' && hasOpenedBilling.current) {
        hasOpenedBilling.current = false;
        // Verify and refresh subscription status
        verifyAndRefresh();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [verifyAndRefresh]);

  // Show content normally while loading or if has subscription
  if (loading || hasActiveSubscription) {
    return <>{children}</>;
  }

  const handleOpenBilling = async () => {
    try {
      // Mark that we're opening billing
      hasOpenedBilling.current = true;
      // Get handoff URL with authentication token
      const webUrl = await getHandoffUrl('billing');
      const canOpen = await Linking.canOpenURL(webUrl);
      if (canOpen) {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Failed to open billing URL:', error);
      hasOpenedBilling.current = false;
    }
  };

  const styles = StyleSheet.create({
    container: {
      position: 'relative',
      overflow: 'hidden',
    },
    blurredContent: {
      opacity: 0.3,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      borderRadius: sp(12),
    },
    lockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
      backgroundColor: '#212121',
      paddingVertical: hp(10),
      paddingHorizontal: wp(16),
      borderRadius: sp(99),
    },
    lockText: {
      fontSize: fp(14),
      fontFamily: fonts.medium,
      color: '#FFFFFF',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.blurredContent} pointerEvents="none">
        {children}
      </View>
      <TouchableOpacity style={styles.overlay} onPress={handleOpenBilling} activeOpacity={0.9}>
        <View style={styles.lockButton}>
          <Crown size={16} color="#FFFFFF" />
          <Text style={styles.lockText}>{message}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
