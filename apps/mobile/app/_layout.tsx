import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@watchsphere/shared/stores';
import { initializeStorage } from '@/lib/storage';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AIButtonProvider } from '@/contexts/AIButtonContext';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';

// Initialize storage for Zustand persist
initializeStorage();

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
  const { colorScheme } = useTheme();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <AnimatedSplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AIButtonProvider>
          <ChatProvider>
            <RootLayoutNav />
          </ChatProvider>
        </AIButtonProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
