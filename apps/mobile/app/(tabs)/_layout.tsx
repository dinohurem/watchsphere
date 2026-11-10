import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Home, BarChart, TradeArrows, ShieldCheckmark, InboxTray } from '@/components/icons';
import { GlassWrapper } from '@/components/LiquidGlassWrapper';
import { useTheme } from '@/contexts/ThemeContext';
import { useActivityUnread } from '@/hooks/useActivityUnread';
import { fp, hp, sp, wp } from '@/utils/responsive';

const ACTIVE = '#3478F6';
const INACTIVE = '#1C1C1E';

type TabIcon = (props: { size?: number; color?: string }) => React.ReactElement;

/** Spec 0.3 + Checks screenshot: Home · Market · Trade · Checks · Activity, full width. */
const TABS: Array<{ name: string; title: string; icon: TabIcon; route: string }> = [
  { name: 'index', title: 'Home', icon: Home, route: '/(tabs)/' },
  { name: 'market', title: 'Market', icon: BarChart, route: '/(tabs)/market' },
  { name: 'trade', title: 'Trade', icon: TradeArrows, route: '/(tabs)/trade' },
  { name: 'checks', title: 'Checks', icon: ShieldCheckmark, route: '/(tabs)/checks' },
  { name: 'activity', title: 'Activity', icon: InboxTray, route: '/(tabs)/activity' },
];

function isActive(pathname: string, name: string) {
  if (name === 'index') {
    return (
      pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/'
    );
  }
  return (
    pathname === `/${name}` || pathname.startsWith(`/${name}/`) || pathname === `/(tabs)/${name}`
  );
}

function CustomTabBar() {
  const { fonts } = useTheme();
  const pathname = usePathname();
  const unread = useActivityUnread();

  return (
    <View style={styles.tabBarContainer} pointerEvents="box-none">
      <GlassWrapper
        style={styles.tabsPill}
        fallbackStyle={styles.tabsPillFallback}
        intensity={95}
        tint="light"
      >
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.name);
          const Icon = tab.icon;
          const color = active ? ACTIVE : INACTIVE;
          const badge = tab.name === 'activity' && unread > 0 ? unread : 0;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => router.replace(tab.route as never)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={badge ? `${tab.title}, ${badge} unread` : tab.title}
            >
              <View style={[styles.tabInner, active && styles.tabInnerActive]}>
                <View style={styles.iconWrap}>
                  <Icon size={sp(24)} color={color} />
                  {badge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={[styles.badgeText, { fontFamily: fonts.bold }]}>
                        {badge > 99 ? '99+' : badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.label,
                    { color, fontFamily: active ? fonts.semiBold : fonts.medium },
                  ]}
                  numberOfLines={1}
                >
                  {tab.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </GlassWrapper>
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="market" />
        <Tabs.Screen name="trade" />
        <Tabs.Screen name="checks" />
        <Tabs.Screen name="activity" />
        {/* Old screens stay reachable by route, but are no longer tabs. */}
        <Tabs.Screen name="chat" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(16),
    paddingTop: hp(12),
    paddingBottom: Platform.OS === 'ios' ? hp(25) : hp(16),
  },
  tabsPill: {
    flexDirection: 'row',
    borderRadius: sp(296),
    overflow: 'hidden',
    padding: sp(4),
  },
  tabsPillFallback: {
    backgroundColor: 'rgba(250, 250, 250, 0.97)',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  tabItem: { flex: 1 },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(6),
    paddingBottom: hp(6),
    borderRadius: sp(100),
    gap: hp(2),
  },
  tabInnerActive: { backgroundColor: 'rgba(118, 118, 128, 0.12)' },
  iconWrap: { height: sp(26), justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -sp(5),
    right: -sp(10),
    minWidth: sp(17),
    height: sp(17),
    paddingHorizontal: sp(4),
    borderRadius: sp(9),
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFFFFF', fontSize: fp(10), lineHeight: fp(12) },
  label: { fontSize: fp(11), textAlign: 'center', letterSpacing: -0.1 },
});
