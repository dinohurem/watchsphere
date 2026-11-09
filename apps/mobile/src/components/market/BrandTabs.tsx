/** Brand tab row with underline on the active tab (spec M2). `null` = "All". */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, wp } from '@/utils/responsive';

import { UI } from './tokens';

export function BrandTabs({
  brands,
  selected,
  onSelect,
}: {
  brands: string[];
  selected: string | null;
  onSelect: (brand: string | null) => void;
}) {
  const { fonts } = useTheme();
  const tabs: Array<{ key: string; value: string | null; label: string }> = [
    { key: '__all__', value: null, label: 'All' },
    ...brands.map((b) => ({ key: b, value: b, label: b })),
  ];
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {tabs.map((tab) => {
          const active = tab.value === selected;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onSelect(tab.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: active ? UI.text : UI.grey,
                    fontFamily: active ? fonts.semiBold : fonts.regular,
                  },
                ]}
              >
                {tab.label}
              </Text>
              <View style={[styles.underline, active && { backgroundColor: UI.text }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  content: { paddingHorizontal: wp(16), gap: wp(18) },
  tab: { paddingTop: hp(4) },
  label: { fontSize: fp(15), paddingBottom: hp(8) },
  underline: { height: 2, borderRadius: 1, backgroundColor: 'transparent' },
});
