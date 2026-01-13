/**
 * WatchSphere Theme
 * Central export for all theme tokens
 */

import { colors } from './colors';
import { typography, fontFamilies, fontWeights } from './typography';
import { spacing, radius, sizes, elevation, divider } from './spacing';
import { shadows } from './shadows';

export { colors } from './colors';
export type { Colors } from './colors';

export { typography, fontFamilies, fontWeights } from './typography';
export type { Typography } from './typography';

export { spacing, radius, sizes, elevation, divider } from './spacing';
export type { Spacing, Radius, Sizes, Elevation } from './spacing';

export { shadows } from './shadows';
export type { Shadows } from './shadows';

// Combined theme object
export const theme = {
  colors,
  typography,
  spacing,
  radius,
  sizes,
  elevation,
  divider,
  shadows,
  fontFamilies,
  fontWeights,
} as const;

export type Theme = typeof theme;
