/**
 * H1 – Recently viewed: one white box with the last 5 opened references, newest on top.
 * Row: small image in a grey square, reference bold, brand + model grey, 1M % chip, chevron.
 */
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ChevronRight, WatchOutline } from '@/components/icons';
import { ChangeChip } from '@/components/market/ChangeChip';
import { openCard } from '@/components/market/MarketCard';
import { StaggerIn } from '@/components/market/StaggerIn';
import { UI } from '@/components/market/tokens';
import type { MarketCardData } from '@/components/market/types';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

export function RecentlyViewed({ items, animate }: { items: MarketCardData[]; animate: boolean }) {
  const { fonts } = useTheme();
  return (
    <View style={styles.box}>
      {items.slice(0, 5).map((card, index) => {
        const uri = card.thumbnail || card.image;
        return (
          <StaggerIn key={`${card.id}-${index}`} index={index} animate={animate}>
            <TouchableOpacity
              style={[styles.row, index > 0 && styles.rowBorder]}
              activeOpacity={0.7}
              onPress={() => openCard(card)}
            >
              <View style={styles.thumb}>
                {uri ? (
                  <Image source={{ uri }} style={styles.thumbImage} resizeMode="contain" />
                ) : (
                  <WatchOutline size={sp(26)} />
                )}
              </View>
              <View style={styles.texts}>
                <Text style={[styles.reference, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                  {card.reference}
                </Text>
                <Text style={[styles.sub, { fontFamily: fonts.regular }]} numberOfLines={1}>
                  {[card.brand, card.model].filter(Boolean).join(' ')}
                </Text>
              </View>
              <ChangeChip value={card.change_1m_pct} />
              <ChevronRight size={sp(16)} color={UI.greyLight} />
            </TouchableOpacity>
          </StaggerIn>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: UI.white,
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: UI.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
    gap: wp(10),
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: UI.border },
  thumb: {
    width: sp(48),
    height: sp(48),
    borderRadius: sp(10),
    backgroundColor: UI.fill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '86%', height: '86%' },
  texts: { flex: 1 },
  reference: { fontSize: fp(15), color: UI.text },
  sub: { fontSize: fp(13), color: UI.grey, marginTop: hp(2) },
});
