import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { formatCount } from '@/utils/marketFormat';
import { fp, sp, wp } from '@/utils/responsive';

import { UI } from './tokens';

export function KindChip({ kind, label }: { kind: 'wts' | 'wtb'; label?: string }) {
  const { fonts } = useTheme();
  const wts = kind === 'wts';
  return (
    <View style={[styles.chip, { backgroundColor: wts ? UI.greenLight : UI.blueLight }]}>
      <Text
        style={[styles.text, { color: wts ? UI.greenText : UI.blue, fontFamily: fonts.semiBold }]}
      >
        {label ?? (wts ? 'WTS' : 'WTB')}
      </Text>
    </View>
  );
}

/** All-time WTS / WTB listing counts, abbreviated from 1.000 ("WTS 1,3k"). */
export function CountChips({ wts, wtb }: { wts: number; wtb: number }) {
  return (
    <View style={styles.row}>
      <KindChip kind="wts" label={`WTS ${formatCount(wts)}`} />
      <KindChip kind="wtb" label={`WTB ${formatCount(wtb)}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: wp(6) },
  chip: {
    paddingHorizontal: wp(7),
    paddingVertical: sp(3),
    borderRadius: sp(8),
  },
  text: { fontSize: fp(11) },
});
