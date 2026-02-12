import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

interface Colors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;

  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Border colors
  border: string;
  borderLight: string;

  // Brand colors
  primary: string;
  primaryLight: string;

  // Card colors
  card: string;
  cardSecondary: string;

  // Status colors
  success: string;
  error: string;
  warning: string;

  // Tab bar colors
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;

  // Button colors
  buttonBackground: string;
  buttonText: string;
}

const lightColors: Colors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F9F9F9',
  backgroundTertiary: '#F5F5F5',

  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#8E8E93',

  border: '#E5E5EA',
  borderLight: '#F2F2F7',

  primary: '#007AFF',
  primaryLight: '#E3F2FF',

  card: '#FFFFFF',
  cardSecondary: '#F9F9F9',

  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',

  tabBarBackground: '#F2F2F7',
  tabBarActive: '#000000',
  tabBarInactive: '#000000',

  buttonBackground: '#F5F5F5',
  buttonText: '#000000',
};

const darkColors: Colors = {
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',

  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#EBEBF599',

  border: '#38383A',
  borderLight: '#48484A',

  primary: '#0A84FF',
  primaryLight: '#1E3A5F',

  card: '#1C1C1E',
  cardSecondary: '#2C2C2E',

  success: '#30D158',
  error: '#FF453A',
  warning: '#FF9F0A',

  tabBarBackground: '#1C1C1E',
  tabBarActive: '#FFFFFF',
  tabBarInactive: '#8E8E93',

  buttonBackground: '#2C2C2E',
  buttonText: '#FFFFFF',
};

interface Fonts {
  light: string;
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
}

const fonts: Fonts = {
  light: 'HankenGrotesk_300Light',
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semiBold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
};

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  colors: Colors;
  fonts: Fonts;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  const [colorScheme, setColorScheme] = useState<ColorScheme>(systemColorScheme || 'light');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          setThemeState(savedTheme as Theme);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  // Update color scheme when theme or system preference changes
  useEffect(() => {
    if (theme === 'system') {
      setColorScheme(systemColorScheme || 'light');
    } else {
      setColorScheme(theme as ColorScheme);
    }
  }, [theme, systemColorScheme]);

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  // Always use light colors — no dark mode support
  const colors = lightColors;

  const value = useMemo(() => ({ theme, colorScheme, colors, fonts, setTheme }), [theme, colorScheme, colors, fonts]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
