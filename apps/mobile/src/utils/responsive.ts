import { Dimensions, PixelRatio } from 'react-native';

// Base design dimensions (based on iPhone 14 Pro - 393x852)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Scale factor based on screen width
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

// Use the smaller scale to ensure content fits on all screens
const scale = Math.min(widthScale, heightScale);

/**
 * Scale a value based on screen width
 * Use for horizontal dimensions (width, paddingHorizontal, marginLeft, etc.)
 */
export function wp(size: number): number {
  return Math.round(size * widthScale);
}

/**
 * Scale a value based on screen height
 * Use for vertical dimensions (height, paddingVertical, marginTop, etc.)
 */
export function hp(size: number): number {
  return Math.round(size * heightScale);
}

/**
 * Scale a value proportionally (uses minimum of width/height scale)
 * Use for elements that should scale uniformly (icons, border radius, fonts)
 */
export function sp(size: number): number {
  return Math.round(size * scale);
}

/**
 * Scale font size with PixelRatio consideration for better readability
 */
export function fp(size: number): number {
  const scaledSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
}

/**
 * Get percentage of screen width
 */
export function widthPercent(percent: number): number {
  return (SCREEN_WIDTH * percent) / 100;
}

/**
 * Get percentage of screen height
 */
export function heightPercent(percent: number): number {
  return (SCREEN_HEIGHT * percent) / 100;
}

/**
 * Normalize size for consistent appearance across different pixel densities
 */
export function normalize(size: number): number {
  const pixelRatio = PixelRatio.get();
  const newSize = size * scale;

  if (pixelRatio >= 3) {
    return Math.round(newSize);
  }
  return Math.round(newSize) - 1;
}

// Export screen dimensions for direct use
export { SCREEN_WIDTH, SCREEN_HEIGHT };

// Export scale factors if needed
export const scales = {
  widthScale,
  heightScale,
  scale,
};
