/**
 * Market / Watchlist card (spec M2, H1): image, 1M % chip top right, brand, model, reference,
 * WTS / WTB all-time count chips. No prices, no badges.
 */
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WatchOutline } from '@/components/icons';
import { useTheme } from '@/contexts/ThemeContext';
import { openWatchDetail } from '@/utils/navigation';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { ChangeChip } from './ChangeChip';
import { CountChips } from './CountChips';
import { Shimmer } from './Shimmer';
import { UI } from './tokens';
import type { MarketCardData } from './types';

export function openCard(card: MarketCardData) {
  openWatchDetail({
    id: card.ws_code || card.id,
    wsCode: card.ws_code,
    reference: card.reference,
    brand: card.brand,
    model: card.model,
  });
}

export function MarketCard({
  card,
  width,
  onPress,
}: {
  card: MarketCardData;
  width: number;
  onPress?: (card: MarketCardData) => void;
}) {
  const { fonts } = useTheme();
  const uri = card.image || card.thumbnail;
  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      activeOpacity={0.85}
      onPress={() => (onPress ? onPress(card) : openCard(card))}
    >
      <View style={styles.imageBox}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <WatchOutline size={sp(56)} />
        )}
        <View style={styles.chip}>
          <ChangeChip value={card.change_1m_pct} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.brand, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {card.brand}
        </Text>
        <Text style={[styles.model, { fontFamily: fonts.regular }]} numberOfLines={1}>
          {card.model || ' '}
        </Text>
        <Text style={[styles.reference, { fontFamily: fonts.regular }]} numberOfLines={1}>
          {card.reference}
        </Text>
        <View style={styles.counts}>
          <CountChips wts={card.wts_count} wtb={card.wtb_count} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function MarketCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]}>
      <Shimmer style={[styles.imageBox, { borderRadius: 0 }]} />
      <View style={styles.body}>
        <Shimmer style={{ width: '45%', height: sp(12) }} />
        <Shimmer style={{ width: '60%', height: sp(12), marginTop: hp(6) }} />
        <Shimmer style={{ width: '70%', height: sp(12), marginTop: hp(6) }} />
        <View style={[styles.counts, { flexDirection: 'row', gap: wp(6) }]}>
          <Shimmer style={{ width: wp(44), height: sp(20), borderRadius: sp(8) }} />
          <Shimmer style={{ width: wp(44), height: sp(20), borderRadius: sp(8) }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.white,
    borderRadius: sp(14),
    borderWidth: 1,
    borderColor: UI.border,
    overflow: 'hidden',
  },
  imageBox: {
    height: sp(150),
    backgroundColor: UI.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '82%', height: '92%' },
  chip: { position: 'absolute', top: sp(8), right: sp(8) },
  body: { paddingHorizontal: wp(12), paddingTop: hp(10), paddingBottom: hp(12) },
  brand: { fontSize: fp(13), color: UI.text },
  model: { fontSize: fp(13), color: UI.text, marginTop: hp(2) },
  reference: { fontSize: fp(13), color: UI.grey, marginTop: hp(2) },
  counts: { marginTop: hp(10) },
});
