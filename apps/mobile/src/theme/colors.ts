/**
 * WatchSphere Color Palette
 * Based on Figma design with iOS-inspired clean aesthetic
 */

export const colors = {
  // Primary Colors
  primary: '#1C1C1E',
  secondary: '#F5F5F5',
  accent: '#2C2C2E',

  // Background Colors
  background: '#FFFFFF',
  surface: '#F8F8F8',
  surfaceLight: '#FAFAFA',

  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#8E8E93',
    tertiary: '#C7C7CC',
  },

  // Status Colors
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#007AFF',

  // Price Changes
  price: {
    positive: '#34C759',
    negative: '#FF3B30',
  },

  // Borders & Dividers
  border: '#E5E5EA',
  borderLight: '#F2F2F7',
  divider: '#E5E5EA',

  // Charts
  chart: {
    line: '#000000',
    background: '#FFFFFF',
    grid: '#F2F2F7',
  },

  // Interactive States
  ripple: 'rgba(0, 0, 0, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.06)',
  shadow: 'rgba(0, 0, 0, 0.08)',

  // Special
  favorite: '#FF3B30',
  favoriteInactive: '#FFFFFF',

  // Transparent
  transparent: 'transparent',
} as const;

export type Colors = typeof colors;
