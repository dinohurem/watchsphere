/** CK4e – Report submitted (same for all three report types). Done goes back to CK1. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckmarkCircleFill } from '@/components/checks/CheckIcons';
import { BlackButton, CARD_SHADOW } from '@/components/checks/ChecksUI';
import { X } from '@/components/icons';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

/** Back to the Checks hub, whatever the stack looks like. */
function backToHub() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/(tabs)/checks' as never);
}

export default function ReportSubmittedScreen() {
  const { fonts } = useTheme();
  const { summary, subtitle } = useLocalSearchParams<{ summary?: string; subtitle?: string }>();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.close} onPress={backToHub} accessibilityLabel="Close">
          <X size={sp(16)} color={UI.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <CheckmarkCircleFill size={sp(84)} color={UI.blue} />
        <Text style={[styles.title, { fontFamily: fonts.bold }]}>Report submitted</Text>
        <Text style={[styles.text, { fontFamily: fonts.regular }]}>
          Thank you. Our team reviews every report before it appears in Checks – usually within 24
          hours. You will get a notification in Activity once it is published.
        </Text>
        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.cardLabel, { fontFamily: fonts.medium }]}>Your report</Text>
          <Text style={[styles.cardTitle, { fontFamily: fonts.bold }]}>{summary}</Text>
          <Text style={[styles.cardSub, { fontFamily: fonts.regular }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <BlackButton label="Done" onPress={backToHub} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.white },
  top: { alignItems: 'flex-end', paddingHorizontal: wp(16), paddingTop: hp(8) },
  close: {
    width: sp(34),
    height: sp(34),
    borderRadius: sp(17),
    backgroundColor: UI.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: wp(16), paddingBottom: hp(16) },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: wp(24), paddingTop: hp(48) },
  title: { fontSize: fp(24), color: UI.text, marginTop: hp(20) },
  text: {
    fontSize: fp(14),
    lineHeight: fp(21),
    color: UI.grey,
    textAlign: 'center',
    marginTop: hp(10),
  },
  card: {
    alignSelf: 'stretch',
    marginTop: hp(28),
    backgroundColor: UI.white,
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: UI.border,
    padding: sp(16),
  },
  cardLabel: { fontSize: fp(12), color: UI.grey },
  cardTitle: { fontSize: fp(16), color: UI.text, marginTop: hp(6) },
  cardSub: { fontSize: fp(13), color: UI.grey, marginTop: hp(3) },
});
