import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import {
  LinksIcon,
  PersonXmarkIcon,
  PhoneHandsetIcon,
  SerialCardIcon,
  WarningTriangleIcon,
  XmarkCircleIcon,
  ChevronSmall,
} from '@/components/checks/CheckIcons';
import { CARD_SHADOW } from '@/components/checks/ChecksUI';
import { AppHeader, ScreenTitle } from '@/components/market/AppHeader';
import { StaggerIn, useFirstAppearance } from '@/components/market/StaggerIn';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

type Entry = {
  key: string;
  title: string;
  text: string;
  tone: 'blue' | 'red';
  route: string;
  icon: (color: string) => React.ReactElement;
};

const ICON = sp(22);

/** CK1 – six equal cards: three blue checks, three red reports. */
const ENTRIES: Entry[] = [
  {
    key: 'serial',
    title: 'Check serial number',
    text: 'See if a watch is reported as stolen, counterfeit or with fake papers.',
    tone: 'blue',
    route: '/checks/serial',
    icon: (c) => <SerialCardIcon size={ICON} color={c} />,
  },
  {
    key: 'dealer',
    title: 'Check dealer number',
    text: 'See if a dealer is verified, has no reports or is a known scammer.',
    tone: 'blue',
    route: '/checks/phone',
    icon: (c) => <PhoneHandsetIcon size={ICON} color={c} />,
  },
  {
    key: 'links',
    title: 'Check links',
    text: 'Enter a reference and see the full link count for each bracelet.',
    tone: 'blue',
    route: '/checks/links',
    icon: (c) => <LinksIcon size={ICON} color={c} />,
  },
  {
    key: 'stolen',
    title: 'Report stolen serial',
    text: 'Add a stolen watch to the database and warn every dealer on WatchSphere.',
    tone: 'red',
    route: '/checks/report/stolen',
    icon: (c) => <WarningTriangleIcon size={ICON} color={c} />,
  },
  {
    key: 'scammer',
    title: 'Report scammer',
    text: 'Add a phone number that scammed you or a dealer you know.',
    tone: 'red',
    route: '/checks/report/scammer',
    icon: (c) => <PersonXmarkIcon size={ICON} color={c} />,
  },
  {
    key: 'counterfeit',
    title: 'Report counterfeit',
    text: 'Report a serial seen on a fake, a Frankenstein watch or with fake papers.',
    tone: 'red',
    route: '/checks/report/counterfeit',
    icon: (c) => <XmarkCircleIcon size={ICON} color={c} />,
  },
];

const COLORS = {
  blue: { fg: UI.blue, bg: UI.blueLight },
  red: { fg: UI.redText, bg: '#FDE7E9' },
};

export default function ChecksScreen() {
  const { fonts } = useTheme();
  const animate = useFirstAppearance('checks:hub', true);

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScreenTitle title="Checks" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {ENTRIES.map((entry, index) => {
          const c = COLORS[entry.tone];
          return (
            <StaggerIn key={entry.key} index={index} animate={animate}>
              <TouchableOpacity
                style={[styles.card, CARD_SHADOW]}
                activeOpacity={0.8}
                onPress={() => router.push(entry.route as never)}
                accessibilityRole="button"
                accessibilityLabel={entry.title}
              >
                <View style={[styles.iconCircle, { backgroundColor: c.bg }]}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {entry.icon(c.fg) as any}
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.title, { fontFamily: fonts.bold }]} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={[styles.text, { fontFamily: fonts.regular }]} numberOfLines={2}>
                    {entry.text}
                  </Text>
                </View>
                <View style={[styles.chevron, { backgroundColor: c.bg }]}>
                  <ChevronSmall size={sp(12)} color={c.fg} />
                </View>
              </TouchableOpacity>
            </StaggerIn>
          );
        })}
        <Text style={[styles.footnote, { fontFamily: fonts.regular }]}>
          All checks are based on the WatchSphere database only. Use them as an extra safety step
          before you trade.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingTop: hp(8), paddingBottom: hp(140), gap: hp(12) },
  card: {
    height: sp(82),
    borderRadius: sp(16),
    backgroundColor: UI.white,
    borderWidth: 1,
    borderColor: UI.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(14),
    gap: wp(12),
  },
  iconCircle: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: fp(17), color: UI.text },
  text: { fontSize: fp(12), lineHeight: fp(16), color: UI.grey, marginTop: hp(2) },
  chevron: {
    width: sp(26),
    height: sp(26),
    borderRadius: sp(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    fontSize: fp(12),
    lineHeight: fp(17),
    color: UI.grey,
    textAlign: 'center',
    marginTop: hp(10),
    paddingHorizontal: wp(8),
  },
});
