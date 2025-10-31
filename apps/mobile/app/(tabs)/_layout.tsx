import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useState, createContext } from 'react';
import { Home, Store, Watch, MessageSquare, User } from '@/components/icons';
import { FloatingAIButtonV2 } from '@/components/FloatingAIButtonV2';
import { AIChatModal } from '@/components/AIChatModal';

// Create context for AI button visibility
export const AIButtonContext = createContext({
  showAIButton: true,
  setShowAIButton: (show: boolean) => {},
});

export default function TabLayout() {
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAIButton, setShowAIButton] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const handleHideButton = () => {
    setShowAIButton(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <AIButtonContext.Provider value={{ showAIButton, setShowAIButton }}>
      <View style={{ flex: 1 }}>
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E5EA',
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
          tabBarIcon: ({ color, focused }) => (
            <Home size={24} color={color} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, focused }) => (
            <Store size={24} color={color} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Watch size={24} color={color} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <MessageSquare size={24} color={color} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <User size={24} color={color} fill={focused ? color : 'none'} />
          ),
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
    </AIButtonContext.Provider>
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
