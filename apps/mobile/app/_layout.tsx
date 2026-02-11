// CRITICAL: Import storage first to initialize it before any stores are created
// This import has a side-effect that sets up AsyncStorage for Zustand persist
import '@/lib/storage';

// Initialize i18n for internationalization
import '@/i18n';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ChatProvider, setNotificationCallback } from '@/contexts/ChatContext';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import { AIButtonProvider } from '@/contexts/AIButtonContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { GuideProvider, useGuide } from '@/contexts/GuideContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
import { NotificationBanner } from '@/components/NotificationBanner';
import { useFonts } from 'expo-font';
import {
  HankenGrotesk_300Light,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Component to connect notification context with chat context and render banner
// This MUST be rendered inside NotificationProvider
function NotificationHandler() {
  const notificationContext = useNotification();
  const { currentNotification, showNotification, dismissNotification } = notificationContext;

  // Connect the notification callback from ChatContext to NotificationContext
  useEffect(() => {
    setNotificationCallback((data) => {
      showNotification({
        type: 'message',  // Set type to 'message' so avatar is displayed
        title: data.title,
        body: data.body,
        avatar: data.avatar,
        conversationId: data.conversationId,
        isGroup: data.isGroup,
      });
    });

    return () => {
      setNotificationCallback(null);
    };
  }, [showNotification]);

  const handleNotificationPress = useCallback((notification: any) => {
    // Navigate based on notification type
    if (notification.type === 'buy_offer' && notification.orderId) {
      // Navigate to order details for buy offer notifications
      router.push(`/order/${notification.orderId}` as any);
    } else if (notification.conversationId) {
      // Navigate to chat conversation
      if (notification.isGroup) {
        router.push({
          pathname: '/chat/group/[id]',
          params: {
            id: notification.conversationId,
            name: notification.title,
          },
        });
      } else {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: notification.conversationId,
            name: notification.title,
          },
        });
      }
    }
  }, []);

  return (
    <NotificationBanner
      notification={currentNotification}
      onPress={handleNotificationPress}
      onDismiss={dismissNotification}
    />
  );
}

function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const login = useAuthStore((state) => state.login);
  const { colorScheme } = useTheme();
  const { checkFirstLogin, startGuide } = useGuide();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
  const [hasCheckedFirstLogin, setHasCheckedFirstLogin] = useState(false);
  const hasNavigatedRef = useRef(false);
  const isFreshLoginRef = useRef(false);
  const sessionRestoreHandledRef = useRef(false);

  // Try to restore session from stored tokens on app startup
  useEffect(() => {
    const restoreSession = async () => {
      // Prevent multiple attempts
      if (hasAttemptedRestore) return;
      setHasAttemptedRestore(true);

      // If already authenticated from zustand persist, we're done
      // This is a session restore, NOT a fresh login
      if (isAuthenticated) {
        sessionRestoreHandledRef.current = true;
        isFreshLoginRef.current = false;
        setIsRestoringSession(false);
        return;
      }

      try {
        // Check if we have a stored token in AsyncStorage
        const token = await AsyncStorage.getItem('auth_token');
        const refreshToken = await AsyncStorage.getItem('refresh_token');

        console.log('Session restore: token exists:', !!token, 'refreshToken exists:', !!refreshToken);

        if (token) {
          // Try to get current user with the stored token
          try {
            const response = await api.get('/auth/me');
            if (response.data) {
              console.log('Session restore: /auth/me successful');
              // Restore the session — NOT a fresh login
              sessionRestoreHandledRef.current = true;
              isFreshLoginRef.current = false;
              login(response.data, token);
              setIsRestoringSession(false);
              return;
            }
          } catch (error: any) {
            console.log('Session restore: /auth/me failed with status:', error.response?.status);
            // Token might be expired, try refresh if we have refresh token
            if (refreshToken && error.response?.status === 401) {
              try {
                console.log('Session restore: attempting token refresh');
                const refreshResponse = await api.post('/auth/refresh', {
                  refresh_token: refreshToken,
                });
                const { user, access_token, refresh_token: newRefreshToken } = refreshResponse.data;

                await AsyncStorage.setItem('auth_token', access_token);
                await AsyncStorage.setItem('refresh_token', newRefreshToken);

                console.log('Session restore: refresh successful');
                // Restored via token refresh — NOT a fresh login
                sessionRestoreHandledRef.current = true;
                isFreshLoginRef.current = false;
                login(user, access_token);
                setIsRestoringSession(false);
                return;
              } catch (refreshError: any) {
                console.log('Session restore: refresh failed:', refreshError.message);
                // Refresh failed, clear tokens
                await AsyncStorage.multiRemove(['auth_token', 'refresh_token']);
              }
            } else if (!refreshToken) {
              console.log('Session restore: no refresh token available');
            }
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      }

      setIsRestoringSession(false);
    };

    // Wait for hydration before attempting restore
    if (hasHydrated && !hasAttemptedRestore) {
      restoreSession();
    }
  }, [hasHydrated, hasAttemptedRestore, isAuthenticated, login]);

  // Detect fresh login: if isAuthenticated transitions to true AFTER session restore is complete
  // and the restore path didn't explicitly handle it, it means the user just logged in fresh
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (!sessionRestoreHandledRef.current && !isRestoringSession && !prevAuthRef.current && isAuthenticated) {
      isFreshLoginRef.current = true;
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isRestoringSession]);

  useEffect(() => {
    // Wait for hydration and session restore before checking auth state
    if (!hasHydrated || isRestoringSession) return;

    // Redirect based on authentication state
    if (isAuthenticated) {
      // Check if notification prompt needs to be shown (only on fresh login, never on session restore)
      const navigateAfterAuth = async () => {
        // Prevent duplicate navigation (ref avoids stale closure issues)
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;

        const notificationPromptShown = await AsyncStorage.getItem('notification_prompt_shown');
        if (isFreshLoginRef.current && !notificationPromptShown) {
          router.replace('/(auth)/notifications');
        } else {
          router.replace('/(tabs)');

          // Only check guide when going to tabs (not notifications screen)
          if (!hasCheckedFirstLogin) {
            setHasCheckedFirstLogin(true);
            checkFirstLogin().then((isFirstLogin) => {
              if (isFirstLogin) {
                setTimeout(() => {
                  startGuide();
                }, 1000);
              }
            });
          }
        }
      };
      navigateAfterAuth();
    } else {
      // Not authenticated — reset so navigation fires again on next login
      hasNavigatedRef.current = false;
      router.replace('/(auth)');
    }
  }, [isAuthenticated, hasHydrated, isRestoringSession]);

  // Show nothing while hydrating or restoring session
  if (!hasHydrated || isRestoringSession) {
    return null;
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen
          name="search"
          options={{
            animation: 'fade',
            animationDuration: 150,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    HankenGrotesk_300Light,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded) {
      onLayoutRootView();
    }
  }, [fontsLoaded, onLayoutRootView]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  if (showSplash) {
    return <AnimatedSplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfigProvider>
          <FilterProvider>
            <SubscriptionProvider>
              <AIButtonProvider>
                <NotificationProvider>
                  <ChatProvider>
                    <GuideProvider>
                      <RootLayoutNav />
                      {/* In-app notification banner - must be inside NotificationProvider */}
                      <NotificationHandler />
                    </GuideProvider>
                  </ChatProvider>
                </NotificationProvider>
              </AIButtonProvider>
            </SubscriptionProvider>
          </FilterProvider>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
