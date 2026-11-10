/**
 * Retail prices sheet (spec v3, section 3: C, C1–C4).
 *
 * Card "Market vs. retail" (worldwide fresh median vs. the list prices, averaged), its own currency
 * chip (the app currency), then the fixed list of 13 countries: flag + name, tax line, local list
 * price bold with the converted value below, and the market-vs-list % on the right.
 * Always "below retail", never "under retail".
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/PickerSheet';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import {
  flagEmoji,
  formatApprox,
  formatPercentWhole,
  formatPrice,
  trendOf,
} from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { CurrencyPickerSheet, ToolbarChip } from './DetailChips';
import {
  DETAIL_COLORS as C,
  LoadState,
  RetailComparison,
  RetailCountry,
  isUnavailableError,
} from './detailTypes';
import { CountUpText } from './motion';

/** Fixed order (spec 3) – used when the endpoint is not reachable so the list never jumps. */
const FALLBACK_COUNTRIES: Pick<RetailCountry, 'code' | 'name' | 'tax_label' | 'list_currency'>[] = [
  { code: 'HK', name: 'Hong Kong', tax_label: 'no VAT', list_currency: 'HKD' },
  { code: 'DE', name: 'Germany', tax_label: 'incl. 19% VAT', list_currency: 'EUR' },
  { code: 'AE', name: 'UAE', tax_label: 'incl. 5% VAT', list_currency: 'AED' },
  { code: 'US', name: 'United States', tax_label: 'excl. sales tax', list_currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', tax_label: 'incl. 20% VAT', list_currency: 'GBP' },
  { code: 'CN', name: 'China', tax_label: 'incl. 13% VAT', list_currency: 'CNY' },
  { code: 'CH', name: 'Switzerland', tax_label: 'incl. 8.1% VAT', list_currency: 'CHF' },
  { code: 'IT', name: 'Italy', tax_label: 'incl. 22% VAT', list_currency: 'EUR' },
  { code: 'ES', name: 'Spain', tax_label: 'incl. 21% VAT', list_currency: 'EUR' },
  { code: 'AT', name: 'Austria', tax_label: 'incl. 20% VAT', list_currency: 'EUR' },
  { code: 'FR', name: 'France', tax_label: 'incl. 20% VAT', list_currency: 'EUR' },
  { code: 'JP', name: 'Japan', tax_label: 'incl. 10% VAT', list_currency: 'JPY' },
  { code: 'SG', name: 'Singapore', tax_label: 'incl. 9% GST', list_currency: 'SGD' },
];

function pctColor(value: number | null | undefined) {
  const t = trendOf(value, 0);
  return t === 'up' ? C.greenText : t === 'down' ? C.redText : C.grey;
}

export function RetailPricesSheet({
  visible,
  onClose,
  wsCode,
  onLoaded,
}: {
  visible: boolean;
  onClose: () => void;
  wsCode: string | null | undefined;
  /** Lets the detail page refresh its chip with the same numbers. */
  onLoaded?: (data: RetailComparison) => void;
}) {
  const { fonts } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [data, setData] = useState<RetailComparison | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [showCurrency, setShowCurrency] = useState(false);
  const [animate, setAnimate] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!visible || !wsCode) return;
    let cancelled = false;
    setState((prev) => (prev === 'ok' ? 'ok' : 'loading'));
    api
      .get(`/market/detail/${encodeURIComponent(wsCode)}/retail`, { params: { currency } })
      .then((res) => {
        if (cancelled) return;
        const next = res.data as RetailComparison;
        setData(next);
        setState('ok');
        onLoaded?.(next);
        setAnimate(!hasAnimated.current);
        hasAnimated.current = true;
      })
      .catch((error) => {
        if (cancelled) return;
        setData(null);
        setState(isUnavailableError(error) ? 'unavailable' : 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, wsCode, currency]);

  const status: RetailComparison['status'] = data?.status ?? 'no_data';
  const avg = data?.avg_vs_retail_pct ?? null;
  const hasAvg = status === 'ok' && avg !== null && Number.isFinite(avg);
  const avgTrend = trendOf(avg, 0);
  const rows: RetailCountry[] =
    data?.countries && data.countries.length > 0
      ? data.countries
      : FALLBACK_COUNTRIES.map((c) => ({
          ...c,
          list_price: null,
          list_price_converted: null,
          vs_retail_pct: null,
          status: status === 'discontinued' ? 'discontinued' : 'no_data',
        }));
  const loading = state === 'loading' || state === 'idle';

  return (
    <BottomSheet visible={visible} title="Retail prices" onClose={onClose} maxHeightPercent={0.92}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={styles.card}>
          <Text style={[styles.cardLabel, { fontFamily: fonts.semiBold }]} numberOfLines={2}>
            {status === 'discontinued' && !loading
              ? 'Market vs. retail – discontinued'
              : !hasAvg && !loading
                ? 'Market vs. retail – no data'
                : 'Market vs. retail'}
          </Text>
          {hasAvg ? (
            <View style={styles.cardValueWrap}>
              <CountUpText
                value={avg}
                format={(v) => formatPercentWhole(v)}
                animate={animate}
                style={[styles.cardValue, { fontFamily: fonts.bold, color: pctColor(avg) }]}
              />
              <Text style={[styles.cardSub, { fontFamily: fonts.regular, color: pctColor(avg) }]}>
                {avgTrend === 'down' ? 'below retail' : avgTrend === 'up' ? 'above retail' : 'at retail'}
              </Text>
            </View>
          ) : loading ? (
            <View style={[styles.skeleton, { width: wp(70), height: hp(26), borderRadius: sp(6) }]} />
          ) : null}
        </View>

        <View style={styles.chipRow}>
          <ToolbarChip icon="exchange" label={currency} onPress={() => setShowCurrency(true)} />
        </View>

        <View style={styles.list}>
          {rows.map((row, index) => {
            const rowStatus = loading ? 'loading' : row.status;
            return (
              <View key={row.code} style={[styles.row, index > 0 && styles.rowBorder]}>
                <Text style={styles.flag}>{flagEmoji(row.code)}</Text>
                <View style={styles.countryCol}>
                  <Text style={[styles.countryName, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={[styles.taxLabel, { fontFamily: fonts.regular }]} numberOfLines={1}>
                    {row.tax_label}
                  </Text>
                </View>
                {rowStatus === 'loading' ? (
                  <View style={[styles.skeleton, { width: wp(90), height: hp(16), borderRadius: sp(4) }]} />
                ) : rowStatus === 'ok' && row.list_price !== null ? (
                  <>
                    <View style={styles.priceCol}>
                      <Text style={[styles.price, { fontFamily: fonts.bold }]} numberOfLines={1}>
                        {formatPrice(row.list_price, row.list_currency)}
                      </Text>
                      {row.list_currency !== currency && row.list_price_converted !== null ? (
                        <Text style={[styles.approx, { fontFamily: fonts.regular }]} numberOfLines={1}>
                          {formatApprox(row.list_price_converted, currency)}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.pct, { fontFamily: fonts.semiBold, color: pctColor(row.vs_retail_pct) }]}
                      numberOfLines={1}
                    >
                      {row.vs_retail_pct === null ? '' : formatPercentWhole(row.vs_retail_pct)}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.statusText, { fontFamily: fonts.medium }]}>
                    {rowStatus === 'discontinued' ? 'Discontinued' : 'No data'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ height: hp(8) }} />
      </ScrollView>
      <CurrencyPickerSheet
        visible={showCurrency}
        selected={currency}
        onClose={() => setShowCurrency(false)}
        onSelect={(next) => {
          setCurrency(next);
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  cardLabel: { fontSize: fp(15), color: C.text, flex: 1, marginRight: wp(12) },
  cardValueWrap: { alignItems: 'flex-end' },
  cardValue: { fontSize: fp(26) },
  cardSub: { fontSize: fp(12), marginTop: hp(1) },
  chipRow: { flexDirection: 'row', marginTop: hp(14), marginBottom: hp(8) },
  list: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: sp(16),
    paddingHorizontal: wp(12),
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hp(56), paddingVertical: hp(8) },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  flag: { fontSize: fp(18), marginRight: wp(10) },
  countryCol: { flex: 1, marginRight: wp(8) },
  countryName: { fontSize: fp(14), color: C.text },
  taxLabel: { fontSize: fp(12), color: C.grey, marginTop: hp(1) },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: fp(14), color: C.text },
  approx: { fontSize: fp(11), color: C.grey, marginTop: hp(1) },
  pct: { width: wp(54), textAlign: 'right', fontSize: fp(13) },
  statusText: { fontSize: fp(13), color: C.grey },
  skeleton: { backgroundColor: '#F2F2F4' },
});
