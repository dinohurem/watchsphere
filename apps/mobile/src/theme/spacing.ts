/**
 * WatchSphere Spacing and Sizing System
 * Based on 4px base unit for consistent spacing
 */

export const spacing = {
  // Base unit
  base: 4,

  // Spacing scale
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,

  // Semantic spacing
  screenPadding: 16,
  cardPadding: 16,
  sectionSpacing: 24,
  listItemSpacing: 12,
  chipSpacing: 8,
  iconPadding: 8,

  // Grid spacing
  gridSpacing: 12,
  gridPadding: 16,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,

  // Component-specific radius
  button: 12,
  card: 12,
  image: 12,
  chip: 20,
  input: 12,
  segmentedControl: 10,
} as const;

export const sizes = {
  // Component heights
  button: {
    small: 36,
    medium: 44,
    large: 52,
  },
  input: 44,
  searchBar: 40,
  tabBar: 60,
  appBar: 44,
  segmentedControl: 36,

  // Icon sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
  },

  // Bottom navigation
  bottomNav: {
    icon: 24,
    height: 60,
  },

  // Chart
  chart: {
    lineWidth: 2,
    height: 200,
    heightSmall: 100,
  },
} as const;

export const elevation = {
  none: 0,
  low: 1,
  medium: 2,
  high: 4,
  xHigh: 8,
} as const;

export const divider = {
  thickness: 1,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Sizes = typeof sizes;
export type Elevation = typeof elevation;
