/**
 * P1 – Profile (profile + settings merged, redesign spec v3 section 9).
 *
 * Opened by the profile button in the header. ACCOUNT → Account details · PREFERENCES → My alerts
 * (count), Currency (9-currency picker), Notifications · INFO → Terms and privacy, Support.
 * Orders are hidden; outlined "Log out" + version at the bottom.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@watchsphere/shared/stores';

import { UI } from '@/components/market/tokens';
import { PickerSheet } from '@/components/PickerSheet';
import { FormBox, FormRow, SectionLabel, SettingsHeader } from '@/components/settings/FormRows';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearResourceCache } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { AppCurrency, CURRENCY_NAMES, SUPPORTED_CURRENCIES } from '@/utils/marketFormat';
import { fp, hp, sp, wp } from '@/utils/responsive';

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: code,
  subtitle: CURRENCY_NAMES[code],
}));

export default function ProfileScreen() {
  const { fonts } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const { currency, setCurrency } = useCurrency();
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const appVersion = Constants.expoConfig?.version || '0.1.0';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .get('/watch-alerts')
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : res.data?.items;
          if (!cancelled && Array.isArray(list)) setAlertCount(list.length);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Log out', 'Do you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'auth-storage']);
          await clearResourceCache();
          queryClient.clear();
          logout();
          router.replace('/(auth)');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionLabel>Account</SectionLabel>
        <FormBox>
          <FormRow
            first
            label="Account details"
            onPress={() => router.push('/account-details' as never)}
          />
        </FormBox>

        <SectionLabel>Preferences</SectionLabel>
        <FormBox>
          <FormRow
            first
            label="My alerts"
            value={alertCount === null ? null : String(alertCount)}
            onPress={() => router.push('/alerts' as never)}
          />
          <FormRow label="Currency" value={currency} onPress={() => setCurrencyOpen(true)} />
          <FormRow
            label="Notifications"
            onPress={() => router.push('/settings/general' as never)}
          />
        </FormBox>

        <SectionLabel>Info</SectionLabel>
        <FormBox>
          <FormRow
            first
            label="Terms and privacy"
            onPress={() => router.push('/terms-privacy' as never)}
          />
          <FormRow label="Support" onPress={() => router.push('/support' as never)} />
        </FormBox>

        <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={[styles.logoutText, { fontFamily: fonts.semiBold }]}>Log out</Text>
        </TouchableOpacity>
        <Text style={[styles.version, { fontFamily: fonts.regular }]}>Version {appVersion}</Text>
      </ScrollView>

      <PickerSheet<AppCurrency>
        visible={currencyOpen}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={currency}
        onClose={() => setCurrencyOpen(false)}
        onDone={(value) => {
          if (value && value !== currency) setCurrency(value);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingBottom: hp(40) },
  logout: {
    marginTop: hp(24),
    height: sp(52),
    borderRadius: sp(26),
    borderWidth: 1,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: fp(16), color: UI.text },
  version: { textAlign: 'center', marginTop: hp(12), fontSize: fp(12), color: UI.greyLight },
});
