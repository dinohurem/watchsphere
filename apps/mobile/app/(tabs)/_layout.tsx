import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useState, useContext } from 'react';
import { Home, BarChart, WristWatch, MessageCircle, User } from '@/components/icons';
import { FloatingAIButtonV2 } from '@/components/FloatingAIButtonV2';
import { AIChatModal } from '@/components/AIChatModal';
import { useTheme } from '@/contexts/ThemeContext';
import { AIButtonContext } from '@/contexts/AIButtonContext';

export default function TabLayout() {
  const { colors, colorScheme } = useTheme();
  const [showAIChat, setShowAIChat] = useState(false);
  const { showAIButton, setShowAIButton } = useContext(AIButtonContext);
  const [showToast, setShowToast] = useState(false);

  const handleHideButton = () => {
    setShowAIButton(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <View style={{ flex: 1 }}>
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? 30 : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: -4,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Home size={24} color={color} fill="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color }) => (
            <BarChart size={24} color={color} fill="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <WristWatch size={24} color={color} fill="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <MessageCircle size={24} color={color} fill="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <User size={24} color={color} fill="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hide from tab bar but keep as tab route
        }}
      />
    </Tabs>

        {/* Floating AI Chat Button - visible on all screens */}
        {showAIButton && (
          <FloatingAIButtonV2
            onPress={() => setShowAIChat(true)}
            onHide={handleHideButton}
          />
        )}

        {/* AI Chat Modal */}
        <AIChatModal visible={showAIChat} onClose={() => setShowAIChat(false)} />

        {/* Toast Notification */}
        {showToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>
              AI assistant hidden. Re-enable in Profile settings.
            </Text>
          </View>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 2000,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
