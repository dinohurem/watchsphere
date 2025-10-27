import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  fill?: string;
}

export function Home({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

export function Store({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <Path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
      <Path d="M12 3v6" />
    </Svg>
  );
}

export function LayoutDashboard({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 3h7v9H3z" />
      <Path d="M14 3h7v5h-7z" />
      <Path d="M14 12h7v9h-7z" />
      <Path d="M3 16h7v5H3z" />
    </Svg>
  );
}

export function MessageSquare({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function User({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </Svg>
  );
}

export function Search({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" />
    </Svg>
  );
}

export function Filter({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 6h18M7 12h10M10 18h4" />
    </Svg>
  );
}

export function Heart({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

export function ArrowLeft({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}

export function ChevronRight({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export function TrendingUp({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M23 6l-9.5 9.5-5-5L1 18" />
      <Path d="M17 6h6v6" />
    </Svg>
  );
}

export function TrendingDown({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M23 18L13.5 8.5l-5 5L1 6" />
      <Path d="M17 18h6v-6" />
    </Svg>
  );
}

export function X({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

export function Watch({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
      <Path d="M12 7v5l3 3" />
    </Svg>
  );
}

export function Image({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
      <Path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      <Path d="M21 15l-5-5L5 21" />
    </Svg>
  );
}

export function Send({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
  );
}
