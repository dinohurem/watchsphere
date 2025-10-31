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

export function Sparkles({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 3v18M18.364 5.636L5.636 18.364M21 12H3M18.364 18.364L5.636 5.636" />
    </Svg>
  );
}

export function Move({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </Svg>
  );
}

export function EyeOff({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </Svg>
  );
}

export function Users({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </Svg>
  );
}

export function Bell({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

export function Activity({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Svg>
  );
}

export function ShoppingCart({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M9 2L1 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5l-8-3z" />
      <Path d="M1 5h18" />
    </Svg>
  );
}

export function Tag({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Path d="M7 7h.01" />
    </Svg>
  );
}

export function Bot({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 8V4H8" />
      <Path d="M4 16h16" />
      <Path d="M4 20h16a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
      <Path d="M8 14h.01M16 14h.01" />
    </Svg>
  );
}

export function Package({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </Svg>
  );
}

export function ClipboardList({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
      <Path d="M9 12h6M9 16h6" />
    </Svg>
  );
}

export function ShieldCheck({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function Grid({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </Svg>
  );
}

export function Clock({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" />
      <Path d="M12 6v6l4 2" />
    </Svg>
  );
}

export function Star({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

export function FileText({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}

export function Lock({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function Languages({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" />
      <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

export function Database({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 2C6.5 2 2 3.6 2 5.5v3c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5v-3C22 3.6 17.5 2 12 2z" />
      <Path d="M2 8.5v3c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5v-3M2 14.5v3c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5v-3" />
    </Svg>
  );
}
