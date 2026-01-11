import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Constants from 'expo-constants';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Chevron Right Icon
function ChevronRightIcon() {
  return (
    <Svg width={sp(8)} height={sp(14)} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}


interface SettingsItemProps {
  title: string;
  onPress: () => void;
}

function SettingsItem({ title, onPress }: SettingsItemProps) {
  return (
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.settingsItemText}>{title}</Text>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const appVersion = Constants.expoConfig?.version || '0.1.0';

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            // Clear auth tokens from AsyncStorage to prevent auto-refresh on next launch
            await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'auth-storage']);
            // Clear zustand store state
            logout();
            router.replace('/(auth)');
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Settings Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Settings Items */}
        <View style={styles.settingsList}>
          <SettingsItem
            title="Profile Settings"
            onPress={() => router.push('/profile-settings')}
          />
          <SettingsItem
            title="Account Details"
            onPress={() => router.push('/account-details' as any)}
          />
          <SettingsItem
            title="Orders"
            onPress={() => router.push('/settings/orders-menu' as any)}
          />
          <SettingsItem
            title="General"
            onPress={() => router.push('/settings/general' as any)}
          />
          <SettingsItem
            title="Terms and Privacy"
            onPress={() => router.push('/terms-privacy' as any)}
          />
          <SettingsItem
            title="Support"
            onPress={() => router.push('/support' as any)}
          />
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Version */}
        <Text style={styles.versionText}>Version {appVersion}</Text>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
  },
  titleSection: {
    marginBottom: hp(20),
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(24),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(31),
  },
  settingsList: {
    gap: hp(8),
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  settingsItemText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
  },
  spacer: {
    flex: 1,
  },
  versionText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#999999',
    textAlign: 'center',
    marginBottom: hp(16),
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.1)',
    borderRadius: sp(12),
    paddingHorizontal: wp(20),
    paddingVertical: hp(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    fontWeight: '400',
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
});
