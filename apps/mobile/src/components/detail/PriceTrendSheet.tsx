/**
 * Price trend sheet (spec v3, section 2: B, B1, B2, B3).
 *
 * Period switch 1W · 1M · 3M · 1Y · All (starts with the table period) + currency chip (the app
 * currency). "Median price" with Fresh (blue) and Used (grey) medians and their change, then the
 * line chart. B2 when there is not enough data, B3 when the endpoint is not live yet (404 / 501).
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomSheet } from '@/components/PickerSheet';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { formatPercent, formatPrice, trendOf } from '@/utils/marketFormat';
import { fp, hp, SCREEN_WIDTH, sp, wp } from '@/utils/responsive';

import { CurrencyPickerSheet, ToolbarChip } from './DetailChips';
import {
  DETAIL_COLORS as C,
  DETAIL_PERIODS,
  DetailPeriod,
  LoadState,
  PriceTrend,
  TrendSeries,
  isUnavailableError,
} from './detailTypes';
import { CountUpText } from './motion';
import { PriceTrendChart } from './PriceTrendChart';

function changeColor(value: number | null | undefined) {
  const t = trendOf(value);
  return t === 'up' ? C.greenText : t === 'down' ? C.redText : C.grey;
}

export function PriceTrendSheet({
  visible,
  onClose,
  wsCode,
  initialPeriod,
}: {
  visible: boolean;
  onClose: () => void;
  wsCode: string | null | undefined;
  initialPeriod: DetailPeriod;
}) {
  const { fonts } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [period, setPeriod] = useState<DetailPeriod>(initialPeriod);
  const [data, setData] = useState<PriceTrend | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [showCurrency, setShowCurrency] = useState(false);
  const [animate, setAnimate] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (visible) setPeriod(initialPeriod);
  }, [visible, initialPeriod]);

  useEffect(() => {
    if (!visible || !wsCode) return;
    let cancelled = false;
    setState((prev) => (prev === 'ok' ? 'ok' : 'loading'));
    api
      .get(`/market/detail/${encodeURIComponent(wsCode)}/trend`, { params: { period, currency } })
      .then((res) => {
        if (cancelled) return;
        setData(res.data as PriceTrend);
        setState('ok');
        // M2: count-up and chart draw only on the first appearance.
        if (!hasAnimated.current) {
          hasAnimated.current = true;
          setAnimate(true);
        } else {
          setAnimate(false);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setData(null);
        setState(isUnavailableError(error) ? 'unavailable' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [visible, wsCode, period, currency]);

  const contentWidth = SCREEN_WIDTH - 40;
  const enough =
    !!data &&
    data.enough_data &&
    (data.fresh?.series?.length ?? 0) + (data.used?.series?.length ?? 0) > 0;

  const renderValue = (label: string, color: string, series: TrendSeries | undefined) => (
    <View style={styles.valueCard}>
      <View style={styles.valueLabelRow}>
        <View style={[styles.legendLine, { backgroundColor: color }]} />
        <Text style={[styles.valueLabel, { fontFamily: fonts.medium }]}>{label}</Text>
      </View>
      <CountUpText
        value={series?.median ?? null}
        format={(v) => formatPrice(Number.isFinite(v) ? v : null, data?.currency || currency)}
        animate={animate}
        style={[styles.valueNumber, { fontFamily: fonts.bold }]}
        numberOfLines={1}
      />
      <Text style={[styles.valueChange, { fontFamily: fonts.semiBold, color: changeColor(series?.change_pct) }]}>
        {formatPercent(series?.change_pct)}
      </Text>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="Price trend" onClose={onClose}>
      <View>
        <View style={styles.controls}>
          <View style={styles.segment}>
            {DETAIL_PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  onPress={() => setPeriod(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { fontFamily: active ? fonts.semiBold : fonts.medium },
                      !active && { color: C.grey },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ToolbarChip icon="exchange" label={currency} onPress={() => setShowCurrency(true)} />
        </View>

        {state === 'unavailable' ? (
          <View style={styles.emptyBox}>
            <View style={styles.ghostChart}>
              <View style={[styles.ghostLine, { top: '35%', backgroundColor: C.blue }]} />
              <View style={[styles.ghostLine, { top: '62%', backgroundColor: C.greyLight }]} />
            </View>
            <View style={styles.soonChip}>
              <Text style={[styles.soonText, { fontFamily: fonts.bold }]}>COMING SOON</Text>
            </View>
            <Text style={[styles.emptyTitle, { fontFamily: fonts.bold }]}>Price trend is on its way</Text>
            <Text style={[styles.emptyBody, { fontFamily: fonts.regular }]}>
              Median prices for Fresh and Used watches will appear here soon.
            </Text>
          </View>
        ) : state === 'loading' || state === 'idle' ? (
          <View>
            <Text style={[styles.sectionLabel, { fontFamily: fonts.semiBold }]}>Median price</Text>
            <View style={styles.valuesRow}>
              <View style={[styles.valueCard, styles.skeleton, { height: hp(76) }]} />
              <View style={[styles.valueCard, styles.skeleton, { height: hp(76) }]} />
            </View>
            <View style={[styles.skeleton, { height: hp(170), borderRadius: sp(12) }]} />
          </View>
        ) : !enough ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyTitle, { fontFamily: fonts.bold }]}>Not enough data yet</Text>
            <Text style={[styles.emptyBody, { fontFamily: fonts.regular }]}>
              There are not enough listings in this period to show a price trend.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={[styles.sectionLabel, { fontFamily: fonts.semiBold }]}>Median price</Text>
            <View style={styles.valuesRow}>
              {renderValue('Fresh', C.blue, data?.fresh)}
              {renderValue('Used', C.greyLight, data?.used)}
            </View>
            <PriceTrendChart
              fresh={data?.fresh?.series ?? []}
              used={data?.used?.series ?? []}
              currency={data?.currency || currency}
              width={contentWidth}
              animate={animate}
            />
          </View>
        )}
        <View style={{ height: hp(12) }} />
        <CurrencyPickerSheet
          visible={showCurrency}
          selected={currency}
          onClose={() => setShowCurrency(false)}
          onSelect={(next) => {
            setCurrency(next);
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: wp(8), marginBottom: hp(16) },
  segment: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F2F2F4',
    borderRadius: sp(10),
    padding: 2,
  },
  segmentItem: {
    flex: 1,
    height: sp(28),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sp(8),
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: fp(13), color: C.text },
  sectionLabel: { fontSize: fp(12), color: C.grey, marginBottom: hp(8) },
  valuesRow: { flexDirection: 'row', gap: wp(10), marginBottom: hp(16) },
  valueCard: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: sp(12),
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
  },
  valueLabelRow: { flexDirection: 'row', alignItems: 'center', gap: wp(6) },
  legendLine: { width: wp(12), height: 2, borderRadius: 1 },
  valueLabel: { fontSize: fp(12), color: C.grey },
  valueNumber: { fontSize: fp(18), color: C.text, marginTop: hp(4) },
  valueChange: { fontSize: fp(13), marginTop: hp(2) },
  skeleton: { backgroundColor: '#F2F2F4' },
  emptyBox: { alignItems: 'center', paddingVertical: hp(28), paddingHorizontal: wp(16) },
  emptyTitle: { fontSize: fp(17), color: C.text, textAlign: 'center' },
  emptyBody: { fontSize: fp(14), color: C.grey, textAlign: 'center', marginTop: hp(6), lineHeight: fp(20) },
  ghostChart: {
    width: '100%',
    height: hp(110),
    borderRadius: sp(12),
    backgroundColor: '#F8F8F8',
    opacity: 0.6,
    marginBottom: hp(16),
  },
  ghostLine: { position: 'absolute', left: '8%', right: '8%', height: 2, opacity: 0.35, borderRadius: 1 },
  soonChip: {
    backgroundColor: C.blueLight,
    borderRadius: sp(99),
    paddingHorizontal: wp(10),
    paddingVertical: hp(4),
    marginBottom: hp(10),
  },
  soonText: { fontSize: fp(11), color: C.blue, letterSpacing: 0.6 },
});
