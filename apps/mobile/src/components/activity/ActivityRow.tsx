/**
 * N1 entry: thumbnail · reference (bold when unread, blue dot) · "flag Country · year · condition"
 * · "Price: 1.428.000 HKD" / "Target: 1.350.000 HKD" / "Target: /" · WTS / WTB chip.
 * Right: round chat button (opens WhatsApp with the dealer) with the age underneath.
 */
import React from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ChatBubbleLines, WatchOutline } from '@/components/icons';
import { KindChip } from '@/components/market/CountChips';
import { Shimmer } from '@/components/market/Shimmer';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { flagEmoji, formatAge, formatPrice, shortCountryName } from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

import type { ActivityEntry } from './types';

export function detailLine(entry: ActivityEntry): string {
  const d = entry.data;
  const parts: string[] = [];
  if (d.country_code || d.country_name) {
    const flag = flagEmoji(d.country_code);
    const name = d.country_code ? shortCountryName(d.country_code, d.country_name) : d.country_name;
    parts.push([flag, name].filter(Boolean).join(' '));
  }
  if (d.year) parts.push(`${d.year}${d.kind === 'wtb' || d.year_plus ? '+' : ''}`);
  if (d.condition) parts.push(d.condition);
  return parts.join(' · ');
}

export function openWhatsApp(phone: string | null | undefined) {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return;
  Linking.openURL(`https://wa.me/${digits}`).catch(() => {
    Alert.alert('WhatsApp', 'Could not open WhatsApp.');
  });
}

export function ActivityRow({
  entry,
  onPress,
}: {
  entry: ActivityEntry;
  onPress: (entry: ActivityEntry) => void;
}) {
  const { fonts } = useTheme();
  const d = entry.data;
  const unread = !entry.read;
  const priceLabel = d.kind === 'wts' ? 'Price: ' : 'Target: ';
  const priceValue =
    d.price !== null && d.currency
      ? formatPrice(d.price, d.currency)
      : d.kind === 'wtb'
        ? '/'
        : '–';
  const more = d.count > 1 ? ` · +${d.count - 1} more` : '';
  const line2 = detailLine(entry);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onPress(entry)}>
      <View style={styles.dotCol}>{unread ? <View style={styles.dot} /> : null}</View>
      <View style={styles.thumb}>
        {d.thumbnail ? (
          <Image source={{ uri: d.thumbnail }} style={styles.thumbImage} resizeMode="contain" />
        ) : (
          <WatchOutline size={sp(26)} />
        )}
      </View>
      <View style={styles.texts}>
        <Text
          style={[styles.reference, { fontFamily: unread ? fonts.bold : fonts.semiBold }]}
          numberOfLines={1}
        >
          {d.reference}
        </Text>
        {line2 ? (
          <Text style={[styles.line, { fontFamily: fonts.regular }]} numberOfLines={1}>
            {line2}
          </Text>
        ) : null}
        <Text style={[styles.line, { fontFamily: fonts.regular }]} numberOfLines={1}>
          {priceLabel}
          <Text style={{ fontFamily: fonts.bold, color: UI.text }}>{priceValue}</Text>
          {more ? <Text style={{ color: UI.greyLight }}>{more}</Text> : null}
        </Text>
        <View style={styles.chip}>
          <KindChip kind={d.kind} />
        </View>
      </View>
      <View style={styles.right}>
        <TouchableOpacity
          style={[styles.chatButton, !d.dealer_phone && { opacity: 0.4 }]}
          onPress={() => openWhatsApp(d.dealer_phone)}
          disabled={!d.dealer_phone}
          accessibilityLabel="Chat with dealer"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <ChatBubbleLines size={sp(22)} color={UI.text} />
        </TouchableOpacity>
        <Text style={[styles.age, { fontFamily: fonts.regular }]}>
          {formatAge(entry.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ActivityRowSkeleton() {
  return (
    <View style={styles.row}>
      <View style={styles.dotCol} />
      <Shimmer style={styles.thumb} />
      <View style={styles.texts}>
        <Shimmer style={{ width: '40%', height: sp(14) }} />
        <Shimmer style={{ width: '70%', height: sp(12), marginTop: hp(8) }} />
        <Shimmer style={{ width: '55%', height: sp(12), marginTop: hp(6) }} />
        <Shimmer style={{ width: wp(36), height: sp(18), marginTop: hp(8), borderRadius: sp(8) }} />
      </View>
      <View style={styles.right}>
        <Shimmer style={[styles.chatButton, { backgroundColor: UI.fill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: wp(16),
    paddingVertical: hp(14),
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    backgroundColor: UI.white,
  },
  dotCol: { width: wp(20), alignItems: 'center', paddingTop: sp(20) },
  dot: { width: sp(8), height: sp(8), borderRadius: sp(4), backgroundColor: UI.blue },
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
  texts: { flex: 1, marginLeft: wp(12) },
  reference: { fontSize: fp(16), color: UI.text },
  line: { fontSize: fp(13), color: UI.grey, marginTop: hp(3) },
  chip: { flexDirection: 'row', marginTop: hp(7) },
  right: { alignItems: 'center', marginLeft: wp(8), paddingTop: hp(8) },
  chatButton: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: UI.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  age: { fontSize: fp(11), color: UI.greyLight, marginTop: hp(6) },
});
