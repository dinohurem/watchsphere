import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { formatPercent, trendOf } from '@/utils/marketFormat';
import { fp, sp, wp } from '@/utils/responsive';

import { UI } from './tokens';

/** 1M % chip: green up, red down, grey "–" for 0 % / no data (spec 0.4). */
export function ChangeChip({ value }: { value: number | null | undefined }) {
  const { fonts } = useTheme();
  const trend = trendOf(value);
  const palette =
    trend === 'up'
      ? { bg: UI.greenLight, fg: UI.greenText }
      : trend === 'down'
        ? { bg: UI.redLight, fg: UI.redText }
        : { bg: UI.line, fg: UI.grey };
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg, fontFamily: fonts.semiBold }]}>
        {formatPercent(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: sp(20),
    paddingHorizontal: wp(6),
    paddingVertical: sp(2),
    borderRadius: sp(6),
    alignItems: 'center',
  },
  text: { fontSize: fp(11) },
});
