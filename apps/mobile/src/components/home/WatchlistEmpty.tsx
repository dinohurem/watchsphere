/**
 * H2 – empty watchlist: grey card with a mini preview of two (slightly tilted) sample watchlist
 * cards, "Your watchlist is empty", hint text and the black "Browse market" button.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { WatchOutline } from '@/components/icons';
import { ChangeChip } from '@/components/market/ChangeChip';
import { CountChips } from '@/components/market/CountChips';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

const SAMPLES = [
  {
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '5811/1G',
    change: 4.2,
    wts: 2200,
    wtb: 1300,
    rotate: '-6deg',
  },
  {
    brand: 'Rolex',
    model: 'Daytona',
    reference: '126518LN Pikachu',
    change: 1.8,
    wts: 4500,
    wtb: 2800,
    rotate: '5deg',
  },
];

export function WatchlistEmpty() {
  const { fonts } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.previews} pointerEvents="none">
        {SAMPLES.map((s) => (
          <View key={s.reference} style={[styles.mini, { transform: [{ rotate: s.rotate }] }]}>
            <View style={styles.miniImage}>
              <WatchOutline size={sp(34)} />
              <View style={styles.miniChip}>
                <ChangeChip value={s.change} />
              </View>
            </View>
            <View style={styles.miniBody}>
              <Text style={[styles.miniBrand, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                {s.brand}
              </Text>
              <Text style={[styles.miniText, { fontFamily: fonts.regular }]} numberOfLines={1}>
                {s.model}
              </Text>
              <Text style={[styles.miniRef, { fontFamily: fonts.regular }]} numberOfLines={1}>
                {s.reference}
              </Text>
              <View style={styles.miniCounts}>
                <CountChips wts={s.wts} wtb={s.wtb} />
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.title, { fontFamily: fonts.semiBold }]}>Your watchlist is empty</Text>
      <Text style={[styles.text, { fontFamily: fonts.regular }]}>
        Start following a reference to see its market here.
      </Text>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.85}
        onPress={() => router.replace('/(tabs)/market' as never)}
      >
        <Text style={[styles.buttonText, { fontFamily: fonts.semiBold }]}>Browse market</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: UI.fill,
    borderRadius: sp(16),
    paddingVertical: hp(22),
    paddingHorizontal: wp(16),
    alignItems: 'center',
  },
  previews: { flexDirection: 'row', justifyContent: 'center', gap: wp(10), marginBottom: hp(18) },
  mini: {
    width: wp(118),
    backgroundColor: UI.white,
    borderRadius: sp(10),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  miniImage: {
    height: sp(66),
    backgroundColor: '#F7F7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChip: { position: 'absolute', top: sp(4), right: sp(4), transform: [{ scale: 0.8 }] },
  miniBody: { padding: sp(7) },
  miniBrand: { fontSize: fp(9), color: UI.text },
  miniText: { fontSize: fp(8.5), color: UI.text, marginTop: 1 },
  miniRef: { fontSize: fp(8.5), color: UI.grey, marginTop: 1 },
  miniCounts: {
    marginTop: hp(5),
    transform: [{ scale: 0.75 }],
    alignSelf: 'flex-start',
    marginLeft: -wp(14),
  },
  title: { fontSize: fp(16), color: UI.text, textAlign: 'center' },
  text: { fontSize: fp(13), color: UI.grey, textAlign: 'center', marginTop: hp(6) },
  button: {
    marginTop: hp(16),
    backgroundColor: UI.text,
    borderRadius: sp(20),
    height: sp(40),
    paddingHorizontal: wp(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: UI.white, fontSize: fp(14) },
});
