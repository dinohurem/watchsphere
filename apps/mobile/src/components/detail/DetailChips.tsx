/**
 * Detail page chips (spec v3, 1.1):
 * - ToolbarChip: small filled grey chip (28 pt, #E9E9EB, 12 pt text) used for sort / period /
 *   currency, dark (#1C1C1E, white text) while its menu is open.
 * - ChipMenu: small dropdown directly below a chip (screen D).
 * - TrendChip / RetailChip: light grey 32 pt chips below the WTS / WTB chips.
 * - CurrencyPickerSheet: the 9-currency picker (spec 0.2).
 */
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PickerSheet } from '@/components/PickerSheet';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AppCurrency,
  CURRENCY_NAMES,
  SUPPORTED_CURRENCIES,
  formatPercent,
  formatPercentWhole,
  trendOf,
} from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

import {
  CheckmarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  ExchangeIcon,
  SortIcon,
} from './DetailIcons';
import { DETAIL_COLORS as C, TrendPoint } from './detailTypes';

type ChipIcon = 'sort' | 'clock' | 'exchange';

interface ToolbarChipProps {
  icon: ChipIcon;
  label: string;
  onPress: (anchor: { x: number; y: number; width: number; height: number }) => void;
  dark?: boolean;
  accessibilityLabel?: string;
}

export function ToolbarChip({ icon, label, onPress, dark, accessibilityLabel }: ToolbarChipProps) {
  const { fonts } = useTheme();
  const ref = useRef<View>(null);
  const color = dark ? '#FFFFFF' : C.text;
  const Icon = icon === 'sort' ? SortIcon : icon === 'clock' ? ClockIcon : ExchangeIcon;
  const handlePress = () => {
    const node = ref.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }));
    } else {
      onPress({ x: 0, y: 0, width: 0, height: 0 });
    }
  };
  return (
    <TouchableOpacity
      ref={ref}
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.toolbarChip, dark && styles.toolbarChipDark]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Icon size={sp(12)} color={color} />
      <Text style={[styles.toolbarChipText, { fontFamily: fonts.semiBold, color }]}>{label}</Text>
      <ChevronDownIcon size={sp(10)} color={color} />
    </TouchableOpacity>
  );
}

export interface ChipMenuOption<T extends string> {
  value: T;
  label: string;
}

/** Small dropdown directly below a toolbar chip; a tap outside closes it. */
export function ChipMenu<T extends string>({
  anchor,
  options,
  selected,
  onSelect,
  onClose,
}: {
  anchor: { x: number; y: number; width: number; height: number } | null;
  options: ChipMenuOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { fonts } = useTheme();
  return (
    <Modal
      visible={anchor !== null}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      {anchor ? (
        <View style={[styles.menu, { left: anchor.x, top: anchor.y + anchor.height + sp(6) }]}>
          {options.map((option, index) => {
            const isSelected = option.value === selected;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.menuRow, index > 0 && styles.menuRowBorder]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.menuText,
                    { fontFamily: isSelected ? fonts.semiBold : fonts.regular },
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected ? <CheckmarkIcon size={sp(14)} color={C.text} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </Modal>
  );
}

/** Mini line of the price trend inside the trend chip. Grey dashed when there is no data. */
export function MiniTrendLine({
  points,
  change,
  width = sp(30),
  height = sp(14),
}: {
  points: number[] | null;
  change: number | null | undefined;
  width?: number;
  height?: number;
}) {
  const trend = trendOf(change);
  if (trend === 'none' || !points) {
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={`M1 ${height / 2} L${width - 1} ${height / 2}`}
          stroke={C.greyLight}
          strokeWidth={1.6}
          strokeDasharray="3,3"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  const color = trend === 'up' ? C.green : trend === 'down' ? C.red : C.greyLight;
  let values = points.filter((v) => Number.isFinite(v));
  if (values.length < 2) {
    // No series to draw – a simple slanted line in the trend direction.
    values = trend === 'up' ? [0, 0.4, 0.3, 1] : trend === 'down' ? [1, 0.6, 0.7, 0] : [0.5, 0.5];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 1.5;
  const d = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function changeColor(value: number | null | undefined): string {
  const trend = trendOf(value);
  if (trend === 'up') return C.greenText;
  if (trend === 'down') return C.redText;
  return C.grey;
}

/** "+4,2% ›" – change of the WTS median over the selected period (A, A2, A3). */
export function TrendChip({
  change,
  series,
  onPress,
}: {
  change: number | null | undefined;
  series: TrendPoint[] | null;
  onPress: () => void;
}) {
  const { fonts } = useTheme();
  const hasValue = trendOf(change) !== 'none';
  return (
    <TouchableOpacity
      style={styles.infoChip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={hasValue ? `Price trend ${formatPercent(change)}` : 'Price trend'}
    >
      <MiniTrendLine points={series ? series.map((p) => p.median) : null} change={change} />
      {hasValue ? (
        <Text style={[styles.infoChipText, { fontFamily: fonts.semiBold, color: changeColor(change) }]}>
          {formatPercent(change)}
        </Text>
      ) : null}
      <ChevronRightIcon size={sp(12)} color={C.greyLight} />
    </TouchableOpacity>
  );
}

/** "Retail +152% ›" / "Retail −18% ›" / "Retail ›" (E, A1). */
export function RetailChip({
  pct,
  onPress,
}: {
  pct: number | null | undefined;
  onPress: () => void;
}) {
  const { fonts } = useTheme();
  const hasValue = pct !== null && pct !== undefined && Number.isFinite(pct);
  return (
    <TouchableOpacity
      style={styles.infoChip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Retail prices"
    >
      <Text style={[styles.infoChipText, { fontFamily: fonts.semiBold, color: C.text }]}>Retail</Text>
      {hasValue ? (
        <Text style={[styles.infoChipText, { fontFamily: fonts.semiBold, color: changeColor(pct) }]}>
          {formatPercentWhole(pct)}
        </Text>
      ) : null}
      <ChevronRightIcon size={sp(12)} color={C.greyLight} />
    </TouchableOpacity>
  );
}

/** The 9-currency picker (spec 0.2) – sets the app currency. */
export function CurrencyPickerSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: AppCurrency;
  onClose: () => void;
  onSelect: (currency: AppCurrency) => void;
}) {
  return (
    <PickerSheet<AppCurrency>
      visible={visible}
      title="Currency"
      onClose={onClose}
      options={SUPPORTED_CURRENCIES.map((code) => ({
        value: code,
        label: code,
        subtitle: CURRENCY_NAMES[code],
      }))}
      selected={selected}
      onDone={(value) => {
        if (value) onSelect(value);
      }}
    />
  );
}

/** Convenience hook for a chip + menu pair. */
export function useChipMenu() {
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  return { anchor, open: setAnchor, close: () => setAnchor(null), isOpen: anchor !== null };
}

const styles = StyleSheet.create({
  toolbarChip: {
    height: sp(28),
    borderRadius: sp(14),
    backgroundColor: C.chip,
    paddingHorizontal: wp(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(5),
  },
  toolbarChipDark: { backgroundColor: C.text },
  toolbarChipText: { fontSize: fp(12), color: C.text },
  menu: {
    position: 'absolute',
    minWidth: wp(190),
    backgroundColor: '#FFFFFF',
    borderRadius: sp(12),
    paddingVertical: hp(2),
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuRow: {
    minHeight: hp(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(14),
    gap: wp(16),
  },
  menuRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  menuText: { fontSize: fp(15), color: C.text },
  infoChip: {
    height: sp(32),
    borderRadius: sp(99),
    backgroundColor: C.chipLight,
    paddingHorizontal: wp(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
  },
  infoChipText: { fontSize: fp(15) },
});
