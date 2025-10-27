import { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * WatchSphere Typography System
 * Using SF Pro-inspired fonts (system default on iOS)
 */

// Font Families (iOS uses system fonts by default)
export const fontFamilies = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

// Font Weights
export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semiBold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

// Typography Styles
export const typography = {
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: fontWeights.bold,
    color: colors.text.primary,
    lineHeight: 36,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontSize: 22,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 28,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontSize: 20,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 26,
    letterSpacing: -0.2,
  } as TextStyle,

  // Watch Names
  watchTitle: {
    fontSize: 17,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 24,
    letterSpacing: -0.4,
  } as TextStyle,

  watchSubtitle: {
    fontSize: 13,
    fontWeight: fontWeights.regular,
    color: colors.text.secondary,
    lineHeight: 18,
    letterSpacing: -0.1,
  } as TextStyle,

  // Prices
  priceLarge: {
    fontSize: 18,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.3,
  } as TextStyle,

  priceMedium: {
    fontSize: 16,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 20,
    letterSpacing: -0.2,
  } as TextStyle,

  priceSmall: {
    fontSize: 14,
    fontWeight: fontWeights.semiBold,
    color: colors.text.primary,
    lineHeight: 18,
    letterSpacing: -0.1,
  } as TextStyle,

  // Body Text
  bodyLarge: {
    fontSize: 17,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
    lineHeight: 24,
    letterSpacing: -0.4,
  } as TextStyle,

  bodyMedium: {
    fontSize: 15,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
    lineHeight: 21,
    letterSpacing: -0.2,
  } as TextStyle,

  bodySmall: {
    fontSize: 13,
    fontWeight: fontWeights.regular,
    color: colors.text.primary,
    lineHeight: 18,
    letterSpacing: -0.1,
  } as TextStyle,

  // Labels
  labelLarge: {
    fontSize: 15,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
    lineHeight: 20,
    letterSpacing: -0.2,
  } as TextStyle,

  labelMedium: {
    fontSize: 13,
    fontWeight: fontWeights.medium,
    color: colors.text.secondary,
    lineHeight: 17,
    letterSpacing: -0.1,
  } as TextStyle,

  labelSmall: {
    fontSize: 11,
    fontWeight: fontWeights.regular,
    color: colors.text.secondary,
    lineHeight: 14,
    letterSpacing: 0,
  } as TextStyle,

  // Buttons
  buttonLarge: {
    fontSize: 17,
    fontWeight: fontWeights.semiBold,
    lineHeight: 20,
    letterSpacing: -0.4,
  } as TextStyle,

  buttonMedium: {
    fontSize: 15,
    fontWeight: fontWeights.semiBold,
    lineHeight: 18,
    letterSpacing: -0.2,
  } as TextStyle,

  buttonSmall: {
    fontSize: 13,
    fontWeight: fontWeights.semiBold,
    lineHeight: 16,
    letterSpacing: -0.1,
  } as TextStyle,

  // Captions
  caption: {
    fontSize: 12,
    fontWeight: fontWeights.regular,
    color: colors.text.secondary,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,

  captionBold: {
    fontSize: 12,
    fontWeight: fontWeights.semiBold,
    color: colors.text.secondary,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,

  // Overline (stats, percentages)
  overline: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    color: colors.text.secondary,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,

  // Price Changes
  priceChangePositive: {
    fontSize: 13,
    fontWeight: fontWeights.regular,
    color: colors.price.positive,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,

  priceChangeNegative: {
    fontSize: 13,
    fontWeight: fontWeights.regular,
    color: colors.price.negative,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,

  // Tab Bar
  tabActive: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
    lineHeight: 14,
    letterSpacing: 0,
  } as TextStyle,

  tabInactive: {
    fontSize: 11,
    fontWeight: fontWeights.regular,
    color: colors.text.secondary,
    lineHeight: 14,
    letterSpacing: 0,
  } as TextStyle,
} as const;

export type Typography = typeof typography;
