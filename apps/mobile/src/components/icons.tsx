import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  fill?: string;
}

export function Home({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M12 2L3 10V21H10V15H14V21H21V10L12 2Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M12 12C13.3807 12 14.5 10.8807 14.5 9.5C14.5 8.11929 13.3807 7 12 7C10.6193 7 9.5 8.11929 9.5 9.5C9.5 10.8807 10.6193 12 12 12Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17.917 20.048C17.46 17.188 14.989 15 12 15C9.01101 15 6.54001 17.188 6.08301 20.048" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

export function BellNotification({ size = 24, color = '#000', fill = 'none', hasNotification = false }: IconProps & { hasNotification?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M10.27 21H13.73" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 2H21V17H3V2Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {hasNotification && (
        <Path d="M21 8C22.6569 8 24 6.65685 24 5C24 3.34315 22.6569 2 21 2C19.3431 2 18 3.34315 18 5C18 6.65685 19.3431 8 21 8Z" fill="#FF383C" stroke="#FF383C" strokeWidth={2} />
      )}
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

export function Plus({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function Phone({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Svg>
  );
}

export function Video({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="m23 7-7 5 7 5V7z" />
      <Path d="M16 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
    </Svg>
  );
}

export function MoreVertical({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </Svg>
  );
}

export function Check({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function Settings({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    </Svg>
  );
}

export function Edit2({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Svg>
  );
}

export function ChevronLeft({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function Zap({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

export function Pin({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </Svg>
  );
}

export function Trash2({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </Svg>
  );
}

export function MoreHorizontal({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </Svg>
  );
}

export function BarChart({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M10 3H14V21H10V3Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M18 9H22V21H18V9Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M2 15H6V21H2V15Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function MessageCircle({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M8 10H16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 14H13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 3C6.477 3 2 7.029 2 12C2 13.843 2.618 15.556 3.675 16.983L2.451 21.549L7.738 20.132C9.032 20.683 10.473 21 12 21C17.523 21 22 16.971 22 12C22 7.029 17.523 3 12 3Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserCircle({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2}>
      <Path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 22c3.87 0 7-1.79 7-4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WristWatch({ size = 24, color = '#000', fill = 'none' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M7.5 6L8.5 1H15.5L16.5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.5 18L8.5 23H15.5L16.5 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4.5 12C4.5 16.1421 7.85786 19.5 12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 7.85786 16.1421 4.5 12 4.5C7.85786 4.5 4.5 7.85786 4.5 12Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.6984 12.0565L13.7244 11.2756L12.9435 9.30164C12.8716 9.11964 12.6954 9 12.5 9C12.3046 9 12.1284 9.11964 12.0565 9.30164L11.2756 11.2756L9.30164 12.0565C9.11964 12.1284 9 12.3046 9 12.5C9 12.6954 9.11964 12.8716 9.30164 12.9435L11.2756 13.7244L12.0565 15.6984C12.1284 15.8804 12.3046 16 12.5 16C12.6954 16 12.8716 15.8804 12.9435 15.6984L13.7244 13.7244L15.6984 12.9435C15.8804 12.8716 16 12.6954 16 12.5C16 12.3046 15.8804 12.1284 15.6984 12.0565Z" fill={color} />
      <Path d="M10.7951 9.20234L10.0379 8.94841L9.78495 8.18501C9.70331 7.93833 9.29749 7.93833 9.21585 8.18501L8.96291 8.94841L8.20571 9.20234C8.08324 9.24345 8 9.35873 8 9.48932C8 9.61991 8.08324 9.73519 8.20571 9.7763L8.96291 10.0302L9.21585 10.7936C9.25667 10.917 9.37113 11 9.5 11C9.62887 11 9.74413 10.9162 9.78415 10.7936L10.0371 10.0302L10.7943 9.7763C10.9168 9.73519 11 9.61991 11 9.48932C11 9.35873 10.9168 9.24345 10.7943 9.20234H10.7951Z" fill={color} />
    </Svg>
  );
}

export function AISparkle({ size = 20, color = '#9747FF' }: IconProps) {
  const scale = size / 20;
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M18.3615 6.72556L14.717 5.28445L13.2748 1.6389C13.0226 1.00334 11.977 1.00334 11.7248 1.6389L10.2826 5.28445L6.63813 6.72556C6.32035 6.85112 6.11035 7.1589 6.11035 7.50001C6.11035 7.84112 6.31924 8.1489 6.63813 8.27445L10.2826 9.71556L11.7248 13.3611C11.8504 13.6789 12.1581 13.8878 12.4993 13.8878C12.8404 13.8878 13.1481 13.6789 13.2737 13.3611L14.7159 9.71556L18.3604 8.27445C18.6781 8.1489 18.8881 7.84112 18.8881 7.50001C18.8881 7.1589 18.6804 6.85112 18.3615 6.72556Z" fill={color} />
      <Path fillRule="evenodd" clipRule="evenodd" d="M5.27799 10.5555C5.66038 10.5555 5.99371 10.8158 6.08645 11.1868L6.63185 13.3683L8.81344 13.9138C9.18442 14.0065 9.44466 14.3398 9.44466 14.7222C9.44466 15.1047 9.18442 15.4379 8.81344 15.5307L6.63185 16.0761L6.08645 18.2577C5.99371 18.6287 5.66038 18.8889 5.27799 18.8889C4.89561 18.8889 4.56228 18.6287 4.46954 18.2577L3.92414 16.0761L1.74255 15.5307C1.37157 15.4379 1.11133 15.1047 1.11133 14.7222C1.11133 14.3398 1.37157 14.0065 1.74255 13.9138L3.92414 13.3683L4.46954 11.1868C4.56228 10.8158 4.89561 10.5555 5.27799 10.5555Z" fill={color} />
    </Svg>
  );
}

export function TriangleUp({ size = 12, color = '#4AA078' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M6 3L9 9H3L6 3Z" fill={color} />
    </Svg>
  );
}

export function TriangleDown({ size = 12, color = '#CC6045' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M6 9L3 3H9L6 9Z" fill={color} />
    </Svg>
  );
}
