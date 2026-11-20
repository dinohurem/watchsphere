/**
 * Checks icon set (spec 0.1 "New icons"): SF-Symbol-style outlines drawn with react-native-svg.
 * The tab icon (`ShieldCheckmark`) lives in components/icons.tsx.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

const stroke = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

/** Serial entry card – creditcard style. */
export function SerialCardIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M7 14.5h4.5" stroke={color} strokeWidth={1.7} {...stroke} />
      <Path d="M7 10h2" stroke={color} strokeWidth={1.7} {...stroke} />
    </Svg>
  );
}

/** Dealer entry card – phone. */
export function PhoneHandsetIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.6 3.8l2.2-.5c.5-.1 1 .2 1.2.7l1 2.7c.2.5 0 1-.4 1.3l-1.5 1.1a11 11 0 005 5l1.1-1.5c.3-.4.8-.6 1.3-.4l2.7 1c.5.2.8.7.7 1.2l-.5 2.2c-.1.7-.7 1.2-1.4 1.2C10.8 18.6 5.4 13.2 5.4 5.2c0-.7.5-1.300 1.200-1.400z"
        stroke={color}
        strokeWidth={1.6}
        {...stroke}
      />
    </Svg>
  );
}

/** Links entry card / bracelet header – three joined rectangles. */
export function LinksIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={8.5} width={6} height={7} rx={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Rect x={9} y={8.5} width={6} height={7} rx={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Rect x={15.5} y={8.5} width={6} height={7} rx={2} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

/** exclamationmark.triangle */
export function WarningTriangleIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.8l9 15.4a1 1 0 01-.9 1.5H3.9a1 1 0 01-.9-1.500L12 3.8z"
        stroke={color}
        strokeWidth={1.7}
        {...stroke}
      />
      <Path d="M12 10v4.2" stroke={color} strokeWidth={1.8} {...stroke} />
      <Circle cx={12} cy={17.2} r={1} fill={color} />
    </Svg>
  );
}

/** person with xmark */
export function PersonXmarkIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={10} cy={8} r={3.5} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M3.5 19.5c.4-3.300 3.100-5.500 6.500-5.500 1.200 0 2.200.2 3.100.7" stroke={color} strokeWidth={1.7} {...stroke} />
      <Path d="M15.5 15.5l5 5M20.5 15.5l-5 5" stroke={color} strokeWidth={1.7} {...stroke} />
    </Svg>
  );
}

/** xmark.circle */
export function XmarkCircleIcon({ size = 22, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M9 9l6 6M15 9l-6 6" stroke={color} strokeWidth={1.7} {...stroke} />
    </Svg>
  );
}

/** checkmark.circle.fill – "Verified" symbol (blue, 84 pt on CK5 / CK4e) and green result check. */
export function CheckmarkCircleFill({ size = 24, color = '#3478F6', mark = '#FFFFFF' }: IconProps & { mark?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={color} />
      <Path d="M7 12.3l3.2 3.2L17 8.7" stroke={mark} strokeWidth={2.2} {...stroke} />
    </Svg>
  );
}

/** Plain checkmark (green "No reports" card). */
export function CheckmarkIcon({ size = 22, color = '#2FA84F' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.4} {...stroke} />
    </Svg>
  );
}

/** info.circle (neutral result card). */
export function InfoCircleIcon({ size = 22, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M12 11v5.2" stroke={color} strokeWidth={1.8} {...stroke} />
      <Circle cx={12} cy={7.9} r={1.1} fill={color} />
    </Svg>
  );
}

/** arrow.up.left.and.arrow.down.right – full-screen button on photos. */
export function ExpandIcon({ size = 16, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.500-6.500"
        stroke={color}
        strokeWidth={2}
        {...stroke}
      />
    </Svg>
  );
}

/** square.and.arrow.up – share. */
export function ShareUpIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.5v11M8.2 7.2L12 3.5l3.800 3.700" stroke={color} strokeWidth={1.8} {...stroke} />
      <Path d="M7.5 10.5h-.8A1.700 1.700 0 005 12.200v6.100A1.700 1.700 0 006.700 20h10.600a1.700 1.700 0 001.700-1.700v-6.100a1.700 1.700 0 00-1.700-1.700h-.8" stroke={color} strokeWidth={1.8} {...stroke} />
    </Svg>
  );
}

/** Small chevron used inside the circular card affordance. */
export function ChevronSmall({ size = 12, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M4.500 2.500L8 6l-3.500 3.500" stroke={color} strokeWidth={1.8} {...stroke} />
    </Svg>
  );
}

/** Upload (tray with arrow) for the dashed "Add photos" button. */
export function UploadIcon({ size = 18, color = '#3478F6' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 15V4.500M8.200 8L12 4.200 15.800 8" stroke={color} strokeWidth={1.8} {...stroke} />
      <Path d="M5 13v4.500A1.500 1.500 0 006.500 19h11a1.500 1.500 0 001.500-1.500V13" stroke={color} strokeWidth={1.8} {...stroke} />
    </Svg>
  );
}

/** Small chevron-down inside the country-code button. */
export function ChevronDownSmall({ size = 10, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M2.500 4.500L6 8l3.500-3.500" stroke={color} strokeWidth={1.6} {...stroke} />
    </Svg>
  );
}
