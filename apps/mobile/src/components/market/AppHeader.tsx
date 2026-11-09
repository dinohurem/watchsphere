/**
 * Shared screen header (spec M2 / H1 / T1 / N1): WS logo, optional search bar
 * ("Search reference, model or brand") and optional round profile button.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Magnifier, User } from '@/components/icons';
import { LogoIcon } from '@/components/LogoIcon';
import type { SheetNode } from '@/components/PickerSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { UI } from './tokens';

export const SEARCH_PLACEHOLDER = 'Search reference, model or brand';

export function openProfile() {
  router.push('/settings' as never);
}

export function AppHeader({
  search = false,
  profile = true,
  onSearchPress,
}: {
  search?: boolean;
  profile?: boolean;
  onSearchPress?: () => void;
}) {
  const { fonts } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <LogoIcon width={sp(33)} height={sp(28)} color={UI.black} />
        {search ? (
          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.8}
            onPress={onSearchPress ?? (() => router.push('/search'))}
            accessibilityRole="search"
          >
            <Magnifier size={sp(17)} color={UI.grey} />
            <Text style={[styles.searchText, { fontFamily: fonts.regular }]} numberOfLines={1}>
              {SEARCH_PLACEHOLDER}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {profile ? (
          <TouchableOpacity
            style={styles.profile}
            onPress={openProfile}
            activeOpacity={0.8}
            accessibilityLabel="Profile"
          >
            <User size={sp(22)} color={UI.text} />
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/** Large left-aligned screen title ("Trade", "Activity", "Checks"). */
export function ScreenTitle({ title, right }: { title: string; right?: SheetNode }) {
  const { fonts } = useTheme();
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.title, { fontFamily: fonts.bold }]}>{title}</Text>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(right ?? null) as any}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: UI.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingTop: hp(8),
    paddingBottom: hp(10),
    gap: wp(12),
    minHeight: sp(60),
  },
  search: {
    flex: 1,
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: UI.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    gap: wp(8),
  },
  searchText: { flex: 1, fontSize: fp(15), color: UI.grey },
  profile: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: UI.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingTop: hp(6),
    paddingBottom: hp(8),
  },
  title: { fontSize: fp(28), color: UI.text },
});
