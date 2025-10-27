import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Home, Store, Watch, MessageSquare, User } from '@/components/icons';

export default function TabLayout() {
  return (
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
          title: 'Inventory',
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
  );
}
