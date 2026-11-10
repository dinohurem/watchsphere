/**
 * Icons for the detail page redesign (spec v3, 0.5). SF-Symbol style line icons.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Neutral round speech bubble with two text lines – never the WhatsApp logo (spec 0.1). */
export function ChatBubbleIcon({ size = 28, color = '#1C1C1E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M14 3.5C8.2 3.5 3.5 7.6 3.5 12.7c0 2.7 1.3 5.1 3.4 6.8l-1 4.3c-.1.5.4.9.9.6l4.4-2.4c.9.2 1.8.3 2.8.3 5.8 0 10.5-4.1 10.5-9.3S19.8 3.5 14 3.5z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M9.5 10.8h9M9.5 14.6h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** clock – period chip. */
export function ClockIcon({ size = 12, color = '#1C1C1E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Circle cx={6} cy={6} r={5} stroke={color} strokeWidth={1.2} />
      <Path d="M6 3.3V6l1.8 1.2" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** arrow.up.arrow.down – sort chip. */
export function SortIcon({ size = 12, color = '#1C1C1E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M3.5 10V2M1.5 4l2-2 2 2M8.5 2v8M6.5 8l2 2 2-2"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** arrow.left.arrow.right – currency chip (same for every currency). */
export function ExchangeIcon({ size = 12, color = '#1C1C1E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1.5 4h9M8.5 2l2 2-2 2M10.5 8h-9M3.5 6l-2 2 2 2"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 10, color = '#1C1C1E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <Path d="M2.5 3.8L5 6.3l2.5-2.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 12, color = '#AEAEB2' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M4.5 2.5L8 6l-3.5 3.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckmarkIcon({ size = 14, color = '#3478F6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 7.3l3 3 6-6.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Star (watchlist) – outline, or filled blue #3478F6 when on the watchlist (spec 8.11). */
export function DetailStarIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  const color = filled ? '#3478F6' : '#1C1C1E';
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11 2.06l2.79 5.64 6.23.91-4.51 4.39 1.06 6.21L11 16.28l-5.57 2.93 1.06-6.21-4.51-4.39 6.23-.91L11 2.06z"
        stroke={color}
        fill={filled ? color : 'none'}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Bell (alerts) – outline, or filled blue #3478F6 when at least one alert exists (spec 8.11). */
export function DetailBellIcon({ filled, size = 22 }: { filled: boolean; size?: number }) {
  const color = filled ? '#3478F6' : '#1C1C1E';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        fill={filled ? color : 'none'}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
