// CRITICAL: Import storage first to initialize it before any stores are created
// This import has a side-effect that sets up AsyncStorage for Zustand persist
import '@/lib/storage';

import { useEffect, useState, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AIButtonProvider } from '@/contexts/AIButtonContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { GuideProvider, useGuide } from '@/contexts/GuideContext';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
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

function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const login = useAuthStore((state) => state.login);
  const { colorScheme } = useTheme();
  const { checkFirstLogin, startGuide } = useGuide();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
  const [hasCheckedFirstLogin, setHasCheckedFirstLogin] = useState(false);

  // Try to restore session from stored tokens on app startup
  useEffect(() => {
    const restoreSession = async () => {
      // Prevent multiple attempts
      if (hasAttemptedRestore) return;
      setHasAttemptedRestore(true);

      // If already authenticated from zustand persist, we're done
      if (isAuthenticated) {
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
              // Restore the session
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

  useEffect(() => {
    // Wait for hydration and session restore before checking auth state
    if (!hasHydrated || isRestoringSession) return;

    // Redirect based on authentication state
    if (isAuthenticated) {
      // User is authenticated, go to main tabs
      router.replace('/(tabs)');

      // Check if this is the first login and show guide
      if (!hasCheckedFirstLogin) {
        setHasCheckedFirstLogin(true);
        checkFirstLogin().then((isFirstLogin) => {
          if (isFirstLogin) {
            // Delay guide start to allow navigation to complete
            setTimeout(() => {
              startGuide();
            }, 1000);
          }
        });
      }
    } else {
      // Not authenticated, go to auth screen
      router.replace('/(auth)');
    }
  }, [isAuthenticated, hasHydrated, isRestoringSession, hasCheckedFirstLogin, checkFirstLogin, startGuide]);

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
            <AIButtonProvider>
              <ChatProvider>
                <GuideProvider>
                  <RootLayoutNav />
                </GuideProvider>
              </ChatProvider>
            </AIButtonProvider>
          </FilterProvider>
        </ConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
