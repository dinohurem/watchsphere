/**
 * Pickers used by the Checks forms. All of them sit on the shared sheet chrome from
 * PickerSheet.tsx (BottomSheet / PickerSheet / SheetButton) – no sheet implementation of its own.
 *  - CountryCodeButton + CountryCodeSheet: country-code button of CK3 / CK4b (flag, "+852").
 *  - CountrySheet: Location (CK4), single country, same list as the AL6 country picker.
 *  - ReferenceSheet: reference picker (M7/M8 style) backed by the Market alias search, plus
 *    "Enter reference manually".
 *  - DateSheet: system date picker (Date of theft).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { CheckCircle, BottomSheet, PICKER_COLORS as P, PickerSheet, SheetButton } from '@/components/PickerSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { flagEmoji } from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { ChevronDownSmall } from './CheckIcons';
import { DIAL_CODES, DialCountry } from './checksModel';

// ---------------------------------------------------------------------------------------------
// Country-code button (CK3 / CK4b)
// ---------------------------------------------------------------------------------------------

export function CountryCodeButton({
  country,
  onPress,
}: {
  country: DialCountry;
  onPress: () => void;
}) {
  const { fonts } = useTheme();
  return (
    <TouchableOpacity
      style={styles.codeButton}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Country code ${country.name} ${country.dial}`}
    >
      <Text style={styles.flag}>{flagEmoji(country.code)}</Text>
      <Text style={[styles.codeText, { fontFamily: fonts.semiBold }]}>{country.dial}</Text>
      <ChevronDownSmall size={sp(10)} color={P.grey} />
    </TouchableOpacity>
  );
}

export function CountryCodeSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (country: DialCountry) => void;
}) {
  return (
    <PickerSheet<string>
      visible={visible}
      title="Country code"
      searchPlaceholder="Search country"
      hideButton
      options={DIAL_CODES.map((c) => ({
        value: c.code,
        label: `${c.name}  ${c.dial}`,
        leading: flagEmoji(c.code),
      }))}
      selected={selected}
      onClose={onClose}
      onDone={(code) => {
        const hit = DIAL_CODES.find((c) => c.code === code);
        if (hit) onSelect(hit);
      }}
    />
  );
}

/** Location (CK4): one country, optional. Same list as the AL6 location picker. */
export function CountrySheet({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: string | null;
  onClose: () => void;
  onSelect: (country: DialCountry | null) => void;
}) {
  return (
    <PickerSheet<string>
      visible={visible}
      title="Location"
      subtitle="Where did it happen?"
      searchPlaceholder="Search country"
      hideButton
      options={[
        { value: '__none__', label: 'Not specified', muted: true },
        ...DIAL_CODES.filter((c, i, all) => all.findIndex((x) => x.code === c.code) === i).map((c) => ({
          value: c.code,
          label: c.name,
          leading: flagEmoji(c.code),
        })),
      ]}
      selected={selected ?? '__none__'}
      onClose={onClose}
      onDone={(code) => onSelect(DIAL_CODES.find((c) => c.code === code) ?? null)}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Reference picker (M7 / M8) – alias search like Market
// ---------------------------------------------------------------------------------------------

export interface PickedReference {
  reference: string;
  brand: string | null;
  model: string | null;
}

interface RefHit extends PickedReference {
  key: string;
}

export function ReferenceSheet({
  visible,
  selected,
  onClose,
  onSelect,
  title = 'Reference',
}: {
  visible: boolean;
  selected: string | null;
  onClose: () => void;
  onSelect: (value: PickedReference) => void;
  title?: string;
}) {
  const { fonts } = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RefHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [focused, setFocused] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setHits([]);
    setManual(false);
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (!visible || manual || !q) {
      setHits([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/market/search', { params: { q } });
        if (id !== requestId.current) return;
        const list: unknown[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
        const seen = new Set<string>();
        const next: RefHit[] = [];
        for (const raw of list as Array<Record<string, unknown>>) {
          const reference = typeof raw.reference === 'string' ? raw.reference : '';
          if (!reference || seen.has(reference)) continue;
          seen.add(reference);
          next.push({
            key: reference,
            reference,
            brand: typeof raw.brand === 'string' ? raw.brand : null,
            model: typeof raw.model === 'string' ? raw.model : null,
          });
        }
        setHits(next);
      } catch {
        if (id === requestId.current) setHits([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, visible, manual]);

  const pick = (value: PickedReference) => {
    onSelect(value);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title={title}
      subtitle={manual ? 'Type the reference exactly as on the watch' : undefined}
      onClose={onClose}
      footer={
        manual ? (
          <SheetButton
            label="Use this reference"
            disabled={!query.trim()}
            onPress={() => pick({ reference: query.trim(), brand: null, model: null })}
          />
        ) : null
      }
    >
      <View style={{ flexShrink: 1 }}>
        <View style={[styles.search, focused && styles.searchFocused]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={manual ? 'Reference' : 'Search reference, model or brand'}
            placeholderTextColor={P.greyLight}
            style={[styles.searchInput, { fontFamily: fonts.regular }]}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            autoCapitalize="characters"
            clearButtonMode="while-editing"
          />
        </View>
        {manual ? null : (
          <>
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => {
                setManual(true);
              }}
            >
              <Text style={[styles.rowLabel, { fontFamily: fonts.medium, color: P.blue }]}>
                Enter reference manually
              </Text>
            </TouchableOpacity>
            {loading ? <ActivityIndicator style={{ marginVertical: hp(12) }} /> : null}
            <FlatList
              data={hits}
              keyExtractor={(h) => h.key}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              ListEmptyComponent={
                query.trim() && !loading ? (
                  <Text style={[styles.empty, { fontFamily: fonts.regular }]}>
                    No reference found. Use “Enter reference manually”.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = item.reference === selected;
                return (
                  <TouchableOpacity
                    style={[styles.row, isSelected && styles.rowSelected]}
                    activeOpacity={0.7}
                    onPress={() => pick(item)}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={[styles.rowLabel, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                        {item.reference}
                      </Text>
                      <Text style={[styles.rowSub, { fontFamily: fonts.regular }]} numberOfLines={1}>
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </Text>
                    </View>
                    <CheckCircle checked={isSelected} />
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Date picker (system)
// ---------------------------------------------------------------------------------------------

export function DateSheet({
  visible,
  value,
  onClose,
  onDone,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onDone: (date: Date | null) => void;
}) {
  const [draft, setDraft] = useState<Date>(value ?? new Date());
  useEffect(() => {
    if (visible) setDraft(value ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return (
    <BottomSheet
      visible={visible}
      title="Date of theft"
      onClose={onClose}
      footer={
        <SheetButton
          label="Done"
          onPress={() => {
            onDone(draft);
            onClose();
          }}
        />
      }
    >
      <View>
        <DateTimePicker
          value={draft}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          onChange={(_, d) => d && setDraft(d)}
          style={{ alignSelf: 'center' }}
        />
        {value ? (
          <TouchableOpacity
            onPress={() => {
              onDone(null);
              onClose();
            }}
            style={{ alignSelf: 'center', padding: sp(8) }}
          >
            <Text style={{ color: P.grey, fontSize: fp(14) }}>Clear date</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  codeButton: {
    height: sp(46),
    borderRadius: sp(14),
    backgroundColor: P.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    gap: wp(6),
  },
  flag: { fontSize: fp(18) },
  codeText: { fontSize: fp(16), color: P.text },
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
  rowLabel: { fontSize: 16, color: P.text },
  rowSub: { fontSize: 13, color: P.grey, marginTop: 1 },
  empty: { fontSize: 14, color: P.grey, paddingHorizontal: 12, paddingVertical: 12 },
});
