import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '@/services/api';

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

// Bell Icon
function BellIcon() {
  return (
    <Svg width={sp(20)} height={sp(20)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Globe Icon
function GlobeIcon() {
  return (
    <Svg width={sp(20)} height={sp(20)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function GeneralSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  // Load notification settings from API
  const loadSettings = async () => {
    try {
      const response = await api.get('/profile/me');
      if (response.data) {
        setPushNotifications(response.data.notifications_enabled ?? true);
        setEmailNotifications(response.data.email_notifications_enabled ?? true);
        setPriceAlerts(response.data.notify_price_changes ?? true);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  // Save notification setting to API
  const updateSetting = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await api.patch('/profile/notifications', { [key]: value });
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      // Revert the toggle on error
      loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handlePushNotificationsChange = (value: boolean) => {
    setPushNotifications(value);
    updateSetting('notifications_enabled', value);
  };

  const handleEmailNotificationsChange = (value: boolean) => {
    setEmailNotifications(value);
    updateSetting('email_notifications_enabled', value);
  };

  const handlePriceAlertsChange = (value: boolean) => {
    setPriceAlerts(value);
    updateSetting('notify_price_changes', value);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </SafeAreaView>
    );
  }

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
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>General</Text>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BellIcon />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive push notifications on your device</Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={handlePushNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: '#212121' }}
                thumbColor="#FFFFFF"
                disabled={saving}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>Receive updates via email</Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={handleEmailNotificationsChange}
                trackColor={{ false: '#E5E5E5', true: '#212121' }}
                thumbColor="#FFFFFF"
                disabled={saving}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Price Alerts</Text>
                <Text style={styles.settingDescription}>Get notified when watch prices change</Text>
              </View>
              <Switch
                value={priceAlerts}
                onValueChange={handlePriceAlertsChange}
                trackColor={{ false: '#E5E5E5', true: '#212121' }}
                thumbColor="#FFFFFF"
                disabled={saving}
              />
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <GlobeIcon />
            <Text style={styles.sectionTitle}>Language</Text>
          </View>

          <View style={styles.settingsGroup}>
            <TouchableOpacity
              style={styles.languageRow}
              activeOpacity={0.7}
              onPress={() => {
                // TODO: Open language picker modal
              }}
            >
              <Text style={styles.settingLabel}>App Language</Text>
              <View style={styles.languageValue}>
                <Text style={styles.selectedLanguage}>{selectedLanguage}</Text>
                <ChevronRightIcon />
              </View>
            </TouchableOpacity>
          </View>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
  },
  titleSection: {
    marginBottom: hp(24),
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(24),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(31),
  },
  section: {
    marginBottom: hp(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(10),
    marginBottom: hp(12),
  },
  sectionTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  settingsGroup: {
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(16),
  },
  settingInfo: {
    flex: 1,
    marginRight: wp(16),
  },
  settingLabel: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(2),
  },
  settingDescription: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    fontWeight: '400',
    color: 'rgba(33, 33, 33, 0.5)',
    lineHeight: fp(18),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(16),
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
  },
  selectedLanguage: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    fontWeight: '500',
    color: 'rgba(33, 33, 33, 0.6)',
  },
});
