/**
 * Alert pickers (spec v3, AL3 year, AL5 condition, AL6 location, AL7 / AL4 target price).
 * All share the PickerSheet chrome (spec 0.1).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BottomSheet,
  CheckCircle,
  PICKER_COLORS as P,
  PickerSheet,
  SheetButton,
} from '@/components/PickerSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { AppCurrency, formatNumber } from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { CurrencyPickerSheet } from '@/components/detail/DetailChips';
import { ChevronDownIcon } from '@/components/detail/DetailIcons';

import {
  AlertCondition,
  AlertType,
  LOCATION_NAMES,
  YearMode,
  locationFlag,
  yearValueLabel,
} from './alertModel';
import { WheelColumn } from './WheelColumn';

// ---------------------------------------------------------------------------------------------
// AL3 – Year
// ---------------------------------------------------------------------------------------------

const YEAR_MODES: { value: YearMode; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'newer', label: 'Newer than' },
  { value: 'exactly', label: 'Exactly' },
  { value: 'older', label: 'Older than' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1990 }, (_, i) => 1990 + i);
const MONTH_ITEMS: { value: number; label: string }[] = [
  { value: 0, label: 'Any month' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1).padStart(2, '0') })),
];
const YEAR_ITEMS = YEARS.map((y) => ({ value: y, label: String(y) }));

export function YearPickerSheet({
  visible,
  mode,
  year,
  month,
  onClose,
  onDone,
}: {
  visible: boolean;
  mode: YearMode;
  year: number | null;
  month: number | null;
  onClose: () => void;
  onDone: (mode: YearMode, year: number | null, month: number | null) => void;
}) {
  const { fonts } = useTheme();
  const [m, setM] = useState<YearMode>(mode);
  const [y, setY] = useState<number>(year ?? CURRENT_YEAR - 4);
  const [mo, setMo] = useState<number>(month ?? 0);

  useEffect(() => {
    if (!visible) return;
    setM(mode);
    setY(year ?? CURRENT_YEAR - 4);
    setMo(month ?? 0);
  }, [visible, mode, year, month]);

  const summary =
    m === 'any' ? 'Any year' : `Year ${yearValueLabel({ year_mode: m, year: y, month: mo || null })}`;

  return (
    <BottomSheet
      visible={visible}
      title="Year"
      onClose={onClose}
      footer={
        <SheetButton
          label="Done"
          onPress={() => {
            if (m === 'any') onDone('any', null, null);
            else onDone(m, y, mo || null);
            onClose();
          }}
        />
      }
    >
      <View>
        <View style={styles.chips}>
          {YEAR_MODES.map((option) => {
            const active = option.value === m;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setM(option.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { fontFamily: fonts.semiBold }, active && { color: '#FFFFFF' }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.wheels}>
          <WheelColumn items={MONTH_ITEMS} value={mo} onChange={setMo} disabled={m === 'any'} />
          <WheelColumn items={YEAR_ITEMS} value={y} onChange={setY} disabled={m === 'any'} />
        </View>
        <Text style={[styles.summary, { fontFamily: fonts.semiBold }]}>{summary}</Text>
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// AL5 – Condition
// ---------------------------------------------------------------------------------------------

export function ConditionPickerSheet({
  visible,
  value,
  onClose,
  onDone,
}: {
  visible: boolean;
  value: AlertCondition;
  onClose: () => void;
  onDone: (value: AlertCondition) => void;
}) {
  return (
    <PickerSheet<AlertCondition>
      visible={visible}
      title="Condition"
      onClose={onClose}
      options={[
        { value: 'any', label: 'Any' },
        { value: 'unworn', label: 'Only unworn' },
        { value: 'used', label: 'Only used' },
      ]}
      selected={value}
      onDone={(v) => onDone(v ?? 'any')}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// AL6 – Location (multi-select)
// ---------------------------------------------------------------------------------------------

const MAIN_LOCATIONS = ['EU', 'HK', 'AE', 'GB', 'US', 'CH', 'CN'];

export const OTHER_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' }, { code: 'BH', name: 'Bahrain' },
  { code: 'BE', name: 'Belgium' }, { code: 'BR', name: 'Brazil' }, { code: 'BG', name: 'Bulgaria' },
  { code: 'CA', name: 'Canada' }, { code: 'HR', name: 'Croatia' }, { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' }, { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' }, { code: 'HU', name: 'Hungary' }, { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' }, { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' }, { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' }, { code: 'KW', name: 'Kuwait' }, { code: 'LB', name: 'Lebanon' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macau' }, { code: 'MY', name: 'Malaysia' },
  { code: 'MT', name: 'Malta' }, { code: 'MX', name: 'Mexico' }, { code: 'MC', name: 'Monaco' },
  { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' }, { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' }, { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'RS', name: 'Serbia' },
  { code: 'SG', name: 'Singapore' }, { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'KR', name: 'South Korea' }, { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' }, { code: 'TW', name: 'Taiwan' }, { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' }, { code: 'UA', name: 'Ukraine' }, { code: 'VN', name: 'Vietnam' },
];

export function countryNameFor(code: string): string {
  return LOCATION_NAMES[code] || OTHER_COUNTRIES.find((c) => c.code === code)?.name || code;
}

const WORLDWIDE = '__worldwide__';

export function LocationPickerSheet({
  visible,
  selected,
  onClose,
  onDone,
}: {
  visible: boolean;
  selected: string[];
  onClose: () => void;
  onDone: (codes: string[]) => void;
}) {
  const { fonts } = useTheme();
  const [codes, setCodes] = useState<string[]>(selected);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCodes(selected);
    setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rows = useMemo(() => {
    const all = [
      { code: WORLDWIDE, name: 'Worldwide' },
      ...MAIN_LOCATIONS.map((code) => ({ code, name: LOCATION_NAMES[code] })),
      ...OTHER_COUNTRIES,
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.code !== WORLDWIDE && r.name.toLowerCase().includes(q));
  }, [query]);

  const toggle = (code: string) => {
    if (code === WORLDWIDE) {
      setCodes([]);
      return;
    }
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  return (
    <BottomSheet
      visible={visible}
      title="Location"
      subtitle="Select one or more"
      onClose={onClose}
      footer={
        <SheetButton
          label={codes.length > 0 ? `Done (${codes.length})` : 'Done'}
          onPress={() => {
            onDone(codes);
            onClose();
          }}
        />
      }
    >
      <View style={{ flexShrink: 1 }}>
        <View style={[styles.search, focused && styles.searchFocused]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search country"
            placeholderTextColor={P.greyLight}
            style={[styles.searchInput, { fontFamily: fonts.regular }]}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.code}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => {
            const isSelected = item.code === WORLDWIDE ? codes.length === 0 : codes.includes(item.code);
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => toggle(item.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{item.code === WORLDWIDE ? '🌐' : locationFlag(item.code)}</Text>
                <Text
                  style={[styles.rowLabel, { fontFamily: isSelected ? fonts.semiBold : fonts.medium }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <CheckCircle checked={isSelected} />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// AL7 / AL4 – Target price
// ---------------------------------------------------------------------------------------------

export function TargetPriceSheet({
  visible,
  type,
  enabled,
  amount,
  currency,
  onClose,
  onDone,
}: {
  visible: boolean;
  type: AlertType;
  enabled: boolean;
  amount: number | null;
  currency: string;
  onClose: () => void;
  onDone: (enabled: boolean, amount: number | null, currency: string) => void;
}) {
  const { fonts } = useTheme();
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(amount ? formatNumber(amount) : '');
  const [cur, setCur] = useState(currency);
  const [showCurrency, setShowCurrency] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOn(enabled);
    setText(amount ? formatNumber(amount) : '');
    setCur(currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  const options =
    type === 'wts'
      ? [
          { on: false, title: 'Any price', subtitle: 'Get notified for every new WTS.' },
          { on: true, title: 'Up to a target price', subtitle: 'Only WTS at or below your price.' },
        ]
      : [
          {
            on: false,
            title: 'Every WTB',
            subtitle: 'Get notified for every WTB, even when no target price is posted.',
          },
          {
            on: true,
            title: 'Only with a target price',
            subtitle: 'Get notified only for WTB offers with a target price.',
          },
        ];

  return (
    <BottomSheet
      visible={visible}
      title="Target price"
      onClose={onClose}
      footer={
        <SheetButton
          label="Done"
          disabled={on && value === null}
          onPress={() => {
            onDone(on && value !== null, on ? value : null, cur);
            onClose();
          }}
        />
      }
    >
      <View>
        {options.map((option) => {
          const selected = option.on === on;
          return (
            <TouchableOpacity
              key={option.title}
              style={[styles.priceOption, selected && styles.rowSelected]}
              onPress={() => setOn(option.on)}
              activeOpacity={0.8}
            >
              <View style={styles.priceOptionHead}>
                <CheckCircle checked={selected} />
                <View style={{ flex: 1, marginLeft: wp(10) }}>
                  <Text style={[styles.rowLabel, { fontFamily: fonts.semiBold }]}>{option.title}</Text>
                  <Text style={[styles.optionSubtitle, { fontFamily: fonts.regular }]}>{option.subtitle}</Text>
                </View>
              </View>
              {option.on ? (
                <View style={[styles.amountBlock, !on && { opacity: 0.4 }]} pointerEvents={on ? 'auto' : 'none'}>
                  <Text style={[styles.amountLabel, { fontFamily: fonts.medium }]}>
                    {type === 'wts' ? 'Maximum target price' : 'Minimum target price'}
                  </Text>
                  <View style={styles.amountRow}>
                    <TextInput
                      value={text}
                      onChangeText={(t) => {
                        const digits = t.replace(/[^0-9]/g, '');
                        setText(digits ? formatNumber(parseInt(digits, 10)) : '');
                      }}
                      editable={on}
                      keyboardType="number-pad"
                      placeholder="Enter amount"
                      placeholderTextColor={P.greyLight}
                      style={[styles.amountInput, { fontFamily: fonts.semiBold }, on && styles.amountInputActive]}
                    />
                    <TouchableOpacity
                      style={styles.currencyButton}
                      onPress={() => setShowCurrency(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.currencyText, { fontFamily: fonts.semiBold }]}>{cur}</Text>
                      <ChevronDownIcon size={sp(10)} color={P.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <CurrencyPickerSheet
          visible={showCurrency}
          selected={cur as AppCurrency}
          onClose={() => setShowCurrency(false)}
          onSelect={(next) => setCur(next)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(8), marginBottom: hp(14) },
  chip: {
    height: sp(32),
    paddingHorizontal: wp(12),
    borderRadius: sp(16),
    backgroundColor: P.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: P.text },
  chipText: { fontSize: fp(13), color: P.text },
  wheels: { flexDirection: 'row', gap: wp(12) },
  summary: { textAlign: 'center', fontSize: fp(14), color: P.text, marginTop: hp(10) },
  search: {
    height: 40,
    borderRadius: 12,
    backgroundColor: P.fill,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchFocused: { borderColor: P.blue, backgroundColor: '#FFFFFF' },
  searchInput: { fontSize: 16, color: P.text, padding: 0 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: P.blueLight },
  flag: { fontSize: 20, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 16, color: P.text, marginRight: 12 },
  priceOption: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  priceOptionHead: { flexDirection: 'row', alignItems: 'flex-start' },
  optionSubtitle: { fontSize: 13, color: P.grey, marginTop: 2 },
  amountBlock: { marginTop: 12, marginLeft: 32 },
  amountLabel: { fontSize: 12, color: P.grey, marginBottom: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 12,
    fontSize: 16,
    color: P.text,
  },
  amountInputActive: { borderColor: P.blue, backgroundColor: '#FFFFFF' },
  currencyButton: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyText: { fontSize: 15, color: P.text },
});
