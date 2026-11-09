/**
 * Settings building blocks (spec 0.1 "Form rows"): white box with 1 px #ECECEF border and 16 px
 * radius, rows 52–56 pt, label left, grey value right, chevron.
 */
import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { UI } from '@/components/market/tokens';
import type { SheetNode } from '@/components/PickerSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

export function SettingsHeader({ title }: { title: string }) {
  const { fonts } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: UI.white }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerSide}
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={sp(24)} color={UI.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSide} />
      </View>
    </SafeAreaView>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { fonts } = useTheme();
  return (
    <Text style={[styles.section, { fontFamily: fonts.medium }]}>{children.toUpperCase()}</Text>
  );
}

export function FormBox({ children }: { children: SheetNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <View style={styles.box}>{children as any}</View>;
}

export function FormRow({
  label,
  value,
  onPress,
  first = false,
  chevron = true,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
}) {
  const { fonts } = useTheme();
  const content = (
    <>
      <Text style={[styles.label, { fontFamily: fonts.medium }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.value, { fontFamily: fonts.regular }]} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {chevron && onPress ? <ChevronRight size={sp(16)} color={UI.greyLight} /> : null}
    </>
  );
  if (!onPress) {
    return <View style={[styles.row, !first && styles.rowBorder]}>{content}</View>;
  }
  return (
    <TouchableOpacity
      style={[styles.row, !first && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {content}
    </TouchableOpacity>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  first = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  first?: boolean;
  disabled?: boolean;
}) {
  const { fonts } = useTheme();
  return (
    <View style={[styles.row, styles.toggleRow, !first && styles.rowBorder]}>
      <View style={{ flex: 1, marginRight: wp(12) }}>
        <Text style={[styles.label, { fontFamily: fonts.medium }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: UI.line, true: UI.green }}
        ios_backgroundColor={UI.line}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
  },
  headerSide: { width: sp(32), height: sp(32), justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: fp(17), color: UI.text },
  section: {
    fontSize: fp(12),
    letterSpacing: 0.6,
    color: UI.grey,
    marginTop: hp(18),
    marginBottom: hp(8),
    marginLeft: wp(4),
  },
  box: {
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: sp(16),
    overflow: 'hidden',
  },
  row: {
    minHeight: sp(54),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    gap: wp(8),
  },
  toggleRow: { paddingVertical: hp(10) },
  rowBorder: { borderTopWidth: 1, borderTopColor: UI.border },
  label: { fontSize: fp(16), color: UI.text },
  value: { flex: 1, textAlign: 'right', fontSize: fp(15), color: UI.grey },
  subtitle: { fontSize: fp(13), color: UI.grey, marginTop: hp(2) },
});
