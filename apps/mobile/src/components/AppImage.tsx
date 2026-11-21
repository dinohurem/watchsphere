/**
 * Single image component for remote images. Wraps expo-image so every screen gets the same
 * defaults: memory + disk cache (decoded images survive list recycling and app restarts),
 * a short fade-in instead of a pop-in, and a recyclingKey option so FlatList rows don't flash
 * the previous row's picture. Accepts the legacy RN `resizeMode` prop to keep call sites small.
 */
import React from 'react';
import { Image as ExpoImage, type ImageProps } from 'expo-image';

type LegacyResizeMode = 'cover' | 'contain' | 'stretch' | 'center';

export type AppImageProps = Omit<ImageProps, 'contentFit'> & {
  contentFit?: ImageProps['contentFit'];
  /** Legacy React Native prop, mapped onto `contentFit`. */
  resizeMode?: LegacyResizeMode;
};

const RESIZE_TO_FIT: Record<LegacyResizeMode, ImageProps['contentFit']> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

export const IMAGE_FADE_MS = 150;

export function AppImage({ resizeMode, contentFit, transition, ...rest }: AppImageProps) {
  return (
    <ExpoImage
      cachePolicy="memory-disk"
      transition={transition ?? IMAGE_FADE_MS}
      contentFit={contentFit ?? (resizeMode ? RESIZE_TO_FIT[resizeMode] : 'cover')}
      {...rest}
    />
  );
}

/** Warm the disk and memory cache for images the user is likely to open next. */
export function prefetchImages(urls: Array<string | null | undefined>) {
  const list = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (list.length === 0) return;
  ExpoImage.prefetch(list, 'memory-disk').catch(() => {});
}
