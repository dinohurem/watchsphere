import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { usePathname } from 'expo-router';
import { router } from 'expo-router';
import { Home, BarChart, WristWatch, MessageCircle, AISparkle } from '@/components/icons';
import { AIChatModal } from '@/components/AIChatModal';
import { useTheme } from '@/contexts/ThemeContext';
import { wp, hp, sp, fp } from '@/utils/responsive';

function CustomTabBar() {
  const { fonts } = useTheme();
  const pathname = usePathname();
  const [showAIChat, setShowAIChat] = useState(false);

  const tabs = [
    { name: 'index', title: 'Home', icon: Home, route: '/(tabs)/' },
    { name: 'market', title: 'Market', icon: BarChart, route: '/(tabs)/market' },
    { name: 'chat', title: 'Chat', icon: MessageCircle, route: '/(tabs)/chat', hasNotification: true },
    { name: 'dashboard', title: 'Inventory', icon: WristWatch, route: '/(tabs)/dashboard' },
  ];

  const isActive = (route: string, name: string) => {
    if (name === 'index') {
      return pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/';
    }
    return pathname.includes(name);
  };

  return (
    <>
      <View style={styles.tabBarContainer}>
        {/* Main tabs pill container */}
        <View style={styles.tabsPillContainer}>
          {tabs.map((tab) => {
            const active = isActive(tab.route, tab.name);
            const IconComponent = tab.icon;
            return (
              <TouchableOpacity
                key={tab.name}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => router.replace(tab.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.tabIconWrapper}>
                  <View style={{ opacity: active ? 1 : 0.7 }}>
                    <IconComponent
                      size={24}
                      color={active ? '#0088FF' : '#404040'}
                      fill="none"
                    />
                  </View>
                  {tab.hasNotification && (
                    <View style={styles.notificationDot} />
                  )}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    active && styles.tabLabelActive,
                    { fontFamily: active ? fonts.semiBold : fonts.medium },
                  ]}
                >
                  {tab.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* AI Sparkle Button */}
        <TouchableOpacity
          style={styles.aiButtonContainer}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.9}
        >
          <View style={styles.aiButton}>
            <AISparkle size={26} color="#9747FF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* AI Chat Modal */}
      <AIChatModal visible={showAIChat} onClose={() => setShowAIChat(false)} />
    </>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="market" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      {/* Custom Tab Bar */}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingHorizontal: wp(25),
    paddingTop: hp(16),
    paddingBottom: Platform.OS === 'ios' ? hp(25) : hp(16),
    gap: wp(16),
  },
  tabsPillContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(247, 247, 247, 0.97)',
    borderRadius: sp(296),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(6),
    paddingBottom: hp(7),
    paddingHorizontal: wp(8),
    gap: hp(1),
  },
  tabItemActive: {
    backgroundColor: '#F0F0F0',
    borderRadius: sp(100),
  },
  tabIconWrapper: {
    height: sp(28),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: wp(-4),
    width: sp(7),
    height: sp(7),
    borderRadius: sp(52),
    backgroundColor: '#C93927',
  },
  tabLabel: {
    fontSize: fp(10),
    color: '#404040',
    textAlign: 'center',
    letterSpacing: -0.1,
    lineHeight: fp(12),
  },
  tabLabelActive: {
    color: '#0088FF',
  },
  aiButtonContainer: {
    width: sp(54),
    height: sp(54),
  },
  aiButton: {
    width: sp(54),
    height: sp(54),
    borderRadius: sp(296),
    backgroundColor: 'rgba(247, 247, 247, 0.97)',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
