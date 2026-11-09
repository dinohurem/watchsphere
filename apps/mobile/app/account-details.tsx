/**
 * P3 – Account details: Email, WhatsApp (the only phone-type contact), Password → Change password.
 * No Apple / Google sign-in rows (social login is removed). Light red "Delete account" with note.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '@watchsphere/shared/stores';

import { UI } from '@/components/market/tokens';
import { FormBox, FormRow, SettingsHeader } from '@/components/settings/FormRows';
import { useTheme } from '@/contexts/ThemeContext';
import { clearResourceCache } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { fp, hp, sp, wp } from '@/utils/responsive';

export default function AccountDetailsScreen() {
  const { fonts } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [email, setEmail] = useState<string>(user?.email ?? '');
  const [whatsapp, setWhatsapp] = useState<string>(user?.whatsapp_phone ?? '');
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .get('/profile/me')
        .then((res) => {
          if (cancelled) return;
          if (res.data?.email) setEmail(res.data.email);
          setWhatsapp(res.data?.whatsapp_phone ?? '');
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will deactivate your account. You will no longer be able to log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.post('/profile/deactivate');
              await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'auth-storage']);
              await clearResourceCache();
              logout();
              router.replace('/(auth)');
            } catch (error: unknown) {
              const detail = (error as { response?: { data?: { detail?: unknown } } })?.response
                ?.data?.detail;
              Alert.alert(
                'Delete account',
                typeof detail === 'string' ? detail : 'Could not delete your account.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title="Account details" />
      <ScrollView contentContainerStyle={styles.content}>
        <FormBox>
          <FormRow first label="Email" value={email || '–'} />
          <FormRow
            label="WhatsApp"
            value={whatsapp || 'Add number'}
            onPress={() =>
              router.push({
                pathname: '/field-edit',
                params: { field: 'whatsapp_phone', value: whatsapp },
              } as never)
            }
          />
          <FormRow
            label="Password"
            value="••••••••"
            onPress={() => router.push('/settings/change-password' as never)}
          />
        </FormBox>

        <TouchableOpacity
          style={[styles.delete, deleting && { opacity: 0.5 }]}
          onPress={deleteAccount}
          disabled={deleting}
          activeOpacity={0.8}
        >
          <Text style={[styles.deleteText, { fontFamily: fonts.semiBold }]}>Delete account</Text>
        </TouchableOpacity>
        <Text style={[styles.note, { fontFamily: fonts.regular }]}>
          This will deactivate your account. You will no longer be able to log in.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingTop: hp(12) },
  delete: {
    marginTop: hp(24),
    height: sp(52),
    borderRadius: sp(26),
    backgroundColor: UI.redLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: fp(16), color: UI.redText },
  note: {
    marginTop: hp(10),
    textAlign: 'center',
    fontSize: fp(12),
    color: UI.grey,
    paddingHorizontal: wp(16),
  },
});
