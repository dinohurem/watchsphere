/** Grey / dark dropdown chip used for "Show: Top movers ▾", "Collection: … ▾", etc. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { ChevronDown } from '@/components/icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, sp, wp } from '@/utils/responsive';

import { UI } from './tokens';

export function FilterButton({
  label,
  value,
  dark = false,
  onPress,
}: {
  label?: string;
  value: string;
  dark?: boolean;
  onPress: () => void;
}) {
  const { fonts } = useTheme();
  const fg = dark ? UI.white : UI.text;
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: dark ? UI.text : UI.fill }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {label ? (
        <Text
          style={[
            styles.label,
            { fontFamily: fonts.regular, color: dark ? UI.greyLight : UI.grey },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Text style={[styles.value, { fontFamily: fonts.semiBold, color: fg }]} numberOfLines={1}>
        {value}
      </Text>
      <ChevronDown size={sp(14)} color={fg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sp(34),
    borderRadius: sp(17),
    paddingHorizontal: wp(12),
    gap: wp(5),
    maxWidth: wp(240),
  },
  label: { fontSize: fp(13) },
  value: { fontSize: fp(13), flexShrink: 1 },
});
