import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { usePathname } from 'expo-router';
import { router } from 'expo-router';
import { Home, BarChart, WristWatch, MessageCircle, AISparkle } from '@/components/icons';
import { AIChatModal } from '@/components/AIChatModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useChat } from '@/contexts/ChatContext';
import { useTranslation } from 'react-i18next';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { GlassWrapper } from '@/components/LiquidGlassWrapper';

function CustomTabBar() {
  const { fonts } = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const [showAIChat, setShowAIChat] = useState(false);

  // Get unread count from chat context
  const { getTotalUnreadCount } = useChat();
  const totalUnreadCount = getTotalUnreadCount();

  const tabs = [
    { name: 'index', titleKey: 'tabs.home', icon: Home, route: '/(tabs)/' },
    { name: 'market', titleKey: 'tabs.market', icon: BarChart, route: '/(tabs)/market' },
    { name: 'chat', titleKey: 'tabs.chat', icon: MessageCircle, route: '/(tabs)/chat', hasNotification: totalUnreadCount > 0 },
    { name: 'dashboard', titleKey: 'tabs.inventory', icon: WristWatch, route: '/(tabs)/dashboard' },
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
        <GlassWrapper
          style={styles.tabsPillContainer}
          fallbackStyle={styles.tabsPillFallback}
          intensity={95}
          tint="light"
        >
          {tabs.map((tab) => {
            const active = isActive(tab.route, tab.name);
            const IconComponent = tab.icon;

            const tabContent = (
              <>
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
                  numberOfLines={1}
                >
                  {t(tab.titleKey)}
                </Text>
              </>
            );

            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => router.replace(tab.route as any)}
                activeOpacity={0.7}
              >
                {active ? (
                  <GlassWrapper
                    style={styles.tabItemActiveGlass}
                    fallbackStyle={styles.tabItemActiveFallback}
                    intensity={95}
                    tint="light"
                  >
                    {tabContent}
                  </GlassWrapper>
                ) : (
                  <View style={styles.tabItemInner}>
                    {tabContent}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </GlassWrapper>

        {/* AI Sparkle Button */}
        <TouchableOpacity
          style={styles.aiButtonContainer}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.9}
        >
          <GlassWrapper
            style={styles.aiButton}
            fallbackStyle={styles.aiButtonFallback}
            intensity={95}
            tint="light"
          >
            <AISparkle size={26} color="#9747FF" />
          </GlassWrapper>
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
    borderRadius: sp(296),
    overflow: 'hidden',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tabsPillFallback: {
    backgroundColor: 'rgba(247, 247, 247, 0.97)',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(6),
    paddingBottom: hp(7),
    gap: hp(1),
  },
  tabItemActiveGlass: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(6),
    paddingBottom: hp(7),
    gap: hp(1),
    borderRadius: sp(100),
    overflow: 'hidden',
  },
  tabItemActiveFallback: {
    backgroundColor: 'rgba(230, 230, 230, 0.7)',
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
    borderRadius: sp(27),
    overflow: 'hidden',
  },
  aiButton: {
    width: sp(54),
    height: sp(54),
    borderRadius: sp(296),
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonFallback: {
    backgroundColor: 'rgba(247, 247, 247, 0.97)',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
});
