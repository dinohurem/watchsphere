/**
 * S1 – Pending approval (redesign spec v3, section 10.2).
 *
 * Shown after sign-up and on every launch until the account is approved. No logo, no log out;
 * the only action is the outlined "Contact us" button. Once /auth/me reports `approved`, the app
 * continues to Home.
 */
import React, { useCallback, useEffect } from 'react';
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

import { useAuthStore } from '@watchsphere/shared/stores';

import { Hourglass } from '@/components/icons';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { fp, hp, sp, wp } from '@/utils/responsive';

type StepState = 'done' | 'current' | 'upcoming';

const STEPS: Array<{ title: string; subtitle: string; state: StepState }> = [
  { title: 'Account created', subtitle: 'Done', state: 'done' },
  { title: 'Review by our team', subtitle: 'Usually within 24 hours', state: 'current' },
  { title: 'Welcome to WatchSphere', subtitle: 'Start tracking the market', state: 'upcoming' },
];

function StepMarker({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <View style={[styles.marker, { backgroundColor: UI.green, borderColor: UI.green }]}>
        <Svg width={sp(12)} height={sp(12)} viewBox="0 0 12 12">
          <Path
            d="M2.5 6.2l2.3 2.3 4.7-5"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={[styles.marker, { borderColor: UI.blue }]}>
        <View style={styles.markerDot} />
      </View>
    );
  }
  return <View style={[styles.marker, { borderColor: '#D1D1D6' }]} />;
}

export default function PendingApprovalScreen() {
  const { fonts } = useTheme();
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const checkApproval = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/auth/me');
      if (res.data?.approved === true) {
        updateUser({ approved: true });
        const promptShown = await AsyncStorage.getItem('notification_prompt_shown');
        router.replace((promptShown ? '/(tabs)' : '/(auth)/notifications') as never);
      }
    } catch {
      // offline – stay on this screen
    }
  }, [isAuthenticated, updateUser]);

  useEffect(() => {
    checkApproval();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkApproval();
    });
    return () => sub.remove();
  }, [checkApproval]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.ringOuter}>
          <View style={styles.ringInner}>
            <View style={styles.core}>
              <Hourglass size={sp(26)} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={[styles.title, { fontFamily: fonts.bold }]}>Your account is under review</Text>
        <Text style={[styles.text, { fontFamily: fonts.regular }]}>
          We review every account to keep WatchSphere a trusted dealer network. You’ll hear from us
          on WhatsApp.
        </Text>

        <View style={styles.progress}>
          {STEPS.map((step, i) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.markerCol}>
                <StepMarker state={step.state} />
                {i < STEPS.length - 1 ? <View style={styles.connector} /> : null}
              </View>
              <View style={styles.stepTexts}>
                <Text
                  style={[
                    styles.stepTitle,
                    { fontFamily: fonts.semiBold },
                    step.state === 'upcoming' && { color: UI.greyLight },
                  ]}
                >
                  {step.title}
                </Text>
                <Text
                  style={[
                    styles.stepSubtitle,
                    { fontFamily: fonts.regular },
                    step.state === 'upcoming' && { color: UI.greyLight },
                  ]}
                >
                  {step.subtitle}
                </Text>
              </View>
              {step.state === 'current' ? (
                <View style={styles.pendingChip}>
                  <Text style={[styles.pendingChipText, { fontFamily: fonts.bold }]}>PENDING</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.contactButton}
          activeOpacity={0.8}
          onPress={() => router.push('/contact' as never)}
        >
          <Text style={[styles.contactText, { fontFamily: fonts.semiBold }]}>Contact us</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: {
    alignItems: 'center',
    paddingHorizontal: wp(24),
    paddingTop: hp(70),
    paddingBottom: hp(24),
  },
  ringOuter: {
    width: sp(136),
    height: sp(136),
    borderRadius: sp(68),
    backgroundColor: 'rgba(228, 238, 251, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: sp(100),
    height: sp(100),
    borderRadius: sp(50),
    backgroundColor: UI.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: sp(64),
    height: sp(64),
    borderRadius: sp(32),
    backgroundColor: UI.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: hp(28),
    fontSize: fp(26),
    lineHeight: fp(32),
    color: UI.text,
    textAlign: 'center',
    maxWidth: wp(260),
  },
  text: {
    marginTop: hp(12),
    fontSize: fp(15),
    lineHeight: fp(21),
    color: UI.grey,
    textAlign: 'center',
  },
  progress: {
    alignSelf: 'stretch',
    marginTop: hp(28),
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  markerCol: { alignItems: 'center', width: sp(24) },
  marker: {
    width: sp(22),
    height: sp(22),
    borderRadius: sp(11),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: { width: sp(10), height: sp(10), borderRadius: sp(5), backgroundColor: UI.blue },
  connector: { width: 1.5, height: hp(22), backgroundColor: UI.line, marginVertical: hp(2) },
  stepTexts: { flex: 1, marginLeft: wp(12) },
  stepTitle: { fontSize: fp(15), color: UI.text },
  stepSubtitle: { fontSize: fp(13), color: UI.grey, marginTop: hp(1) },
  pendingChip: {
    backgroundColor: UI.blueLight,
    borderRadius: sp(8),
    paddingHorizontal: wp(8),
    paddingVertical: sp(3),
    marginTop: hp(2),
  },
  pendingChipText: { fontSize: fp(11), letterSpacing: 0.6, color: UI.blue },
  footer: { paddingHorizontal: wp(24), paddingBottom: hp(12) },
  contactButton: {
    height: sp(52),
    borderRadius: sp(26),
    borderWidth: 1,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: { fontSize: fp(16), color: UI.text },
});
