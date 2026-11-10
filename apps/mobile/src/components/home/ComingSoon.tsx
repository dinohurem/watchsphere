/**
 * Coming-soon placeholder (spec T1, also used for Checks): ghosted placeholder cards fading out,
 * icon on a light-blue circle, "COMING SOON" chip, title and one neutral line.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { UI } from '@/components/market/tokens';
import { AppHeader, ScreenTitle } from '@/components/market/AppHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

export function ComingSoon({
  title,
  heading,
  text,
  icon,
}: {
  title: string;
  heading: string;
  text: string;
  icon: React.ReactElement;
}) {
  const { fonts } = useTheme();
  return (
    <View style={styles.container}>
      <AppHeader />
      <ScreenTitle title={title} />
      <View style={styles.body}>
        <View style={styles.ghosts} pointerEvents="none">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.ghost}>
              <View style={styles.ghostCircle} />
              <View style={{ flex: 1 }}>
                <View style={[styles.ghostLine, { width: '45%' }]} />
                <View style={[styles.ghostLine, { width: '75%', marginTop: hp(10) }]} />
              </View>
            </View>
          ))}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', '#FFFFFF']}
            locations={[0, 0.45, 0.8]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.center}>
          <View style={styles.iconCircle}>{icon as never}</View>
          <View style={styles.chip}>
            <Text style={[styles.chipText, { fontFamily: fonts.bold }]}>COMING SOON</Text>
          </View>
          <Text style={[styles.heading, { fontFamily: fonts.bold }]}>{heading}</Text>
          <Text style={[styles.text, { fontFamily: fonts.regular }]}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  body: { flex: 1, paddingHorizontal: wp(16), paddingTop: hp(8) },
  ghosts: { gap: hp(12) },
  ghost: {
    height: sp(84),
    borderRadius: sp(16),
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    gap: wp(14),
  },
  ghostCircle: { width: sp(46), height: sp(46), borderRadius: sp(23), backgroundColor: UI.fill },
  ghostLine: { height: sp(10), borderRadius: sp(5), backgroundColor: UI.fill },
  center: {
    position: 'absolute',
    top: hp(190),
    left: wp(16),
    right: wp(16),
    alignItems: 'center',
  },
  iconCircle: {
    width: sp(56),
    height: sp(56),
    borderRadius: sp(28),
    backgroundColor: UI.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    marginTop: hp(14),
    paddingHorizontal: wp(10),
    paddingVertical: sp(4),
    borderRadius: sp(8),
    backgroundColor: UI.blueLight,
  },
  chipText: { fontSize: fp(12), letterSpacing: 0.8, color: UI.blue },
  heading: { marginTop: hp(12), fontSize: fp(20), color: UI.text, textAlign: 'center' },
  text: { marginTop: hp(8), fontSize: fp(14), color: UI.grey, textAlign: 'center' },
});
