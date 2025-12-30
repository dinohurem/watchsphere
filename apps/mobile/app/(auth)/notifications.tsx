import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Back Arrow Icon
function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth={2}>
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}

// WS Logo Icon for notification
function WSLogoSmall() {
  return (
    <View style={styles.notificationIcon}>
      <Svg width={24} height={24} viewBox="0 0 40 40" fill="none">
        {/* W shape */}
        <Path
          d="M5 10 L11 27 L17 15 L23 27 L29 10"
          stroke="#FFFFFF"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Horizontal lines */}
        <Path d="M3 14 H35" stroke="#FFFFFF" strokeWidth={1.5} />
        <Path d="M3 21 H35" stroke="#FFFFFF" strokeWidth={1.5} />
        {/* S */}
        <Path
          d="M28 11 C35 11 35 16 28 16 C21 16 21 21 28 21 C35 21 35 26 28 26"
          stroke="#FFFFFF"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export default function NotificationsPermissionScreen() {
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const requestNotificationPermissions = async () => {
    setLoading(true);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Mark that we've shown the notification prompt
      await AsyncStorage.setItem('notification_prompt_shown', 'true');

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Mark that we've shown the notification prompt (but user skipped)
    await AsyncStorage.setItem('notification_prompt_shown', 'true');
    router.replace('/(tabs)');
  };

  // Progress bar showing last step
  const renderProgressBar = () => {
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: '100%' }]} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <BackArrow />
        </TouchableOpacity>
        {renderProgressBar()}
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Turn on notifications</Text>
        <Text style={styles.subtitle}>
          Stay informed about new watches, price drops, and activity from your followed sellers and collections.
        </Text>

        {/* Notification Preview Card */}
        <View style={styles.previewContainer}>
          <View style={styles.previewWrapper}>
            {/* Background gradient */}
            <View style={styles.previewGradient} />

            {/* Phone frame */}
            <View style={styles.phoneFrame} />
            <View style={styles.phoneScreen} />

            {/* Notification bubble */}
            <View style={styles.notificationBubble}>
              <WSLogoSmall />
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>Watch Sphere</Text>
                  <Text style={styles.notificationTime}>9:41 AM</Text>
                </View>
                <Text style={styles.notificationText}>
                  New listing available for a watch you're tracking. Take a look before it's gone.
                </Text>
              </View>
            </View>

            {/* Mock collapsed notifications */}
            <View style={styles.mockList}>
              <View style={styles.mockListItem}>
                <View style={styles.mockIconPlaceholder}>
                  <WSLogoSmall />
                </View>
                <View style={styles.mockTextLines}>
                  <View style={styles.mockLineRow}>
                    <View style={[styles.mockLine, { flex: 1 }]} />
                    <View style={[styles.mockLine, { width: wp(37) }]} />
                  </View>
                  <View style={[styles.mockLine, { width: wp(182) }]} />
                </View>
              </View>
              <View style={styles.mockListItem}>
                <View style={styles.mockIconPlaceholder}>
                  <WSLogoSmall />
                </View>
                <View style={styles.mockTextLines}>
                  <View style={styles.mockLineRow}>
                    <View style={[styles.mockLine, { flex: 1 }]} />
                    <View style={[styles.mockLine, { width: wp(37) }]} />
                  </View>
                  <View style={[styles.mockLine, { width: wp(182) }]} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer text */}
        <Text style={styles.footerText}>
          You can manage your notification preferences from application settings.
        </Text>
      </View>

      {/* Bottom Button */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.continueButton, loading && styles.buttonDisabled]}
          onPress={requestNotificationPermissions}
          disabled={loading}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Please wait...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
    gap: wp(16),
  },
  backButton: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(296),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    width: wp(188),
    height: hp(4),
    backgroundColor: '#212121',
    borderRadius: sp(99),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#212121',
    borderRadius: sp(99),
  },
  headerSpacer: {
    width: sp(44),
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(24),
    paddingTop: hp(16),
  },
  title: {
    fontSize: fp(34),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(8),
    letterSpacing: -0.6,
    lineHeight: fp(41),
  },
  subtitle: {
    fontSize: fp(17),
    color: 'rgba(29, 29, 31, 0.6)',
    lineHeight: fp(22),
    marginBottom: hp(24),
    letterSpacing: -0.43,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: hp(24),
  },
  previewWrapper: {
    width: wp(354),
    height: hp(296),
    borderRadius: sp(43),
    overflow: 'hidden',
    position: 'relative',
  },
  previewGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E9E9E9',
    borderRadius: sp(43),
  },
  phoneFrame: {
    position: 'absolute',
    top: hp(39),
    left: wp(41),
    width: wp(274),
    height: hp(202),
    backgroundColor: '#282828',
    borderTopLeftRadius: sp(31),
    borderTopRightRadius: sp(31),
  },
  phoneScreen: {
    position: 'absolute',
    top: hp(49),
    left: wp(51),
    width: wp(255),
    height: hp(210),
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: sp(22),
    borderTopRightRadius: sp(22),
  },
  notificationBubble: {
    position: 'absolute',
    top: hp(66),
    left: wp(18),
    width: wp(319),
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: sp(21),
    padding: wp(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 29,
    elevation: 8,
  },
  notificationIcon: {
    width: sp(33),
    height: sp(33),
    borderRadius: sp(8),
    backgroundColor: '#1D1D1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(9),
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  notificationTitle: {
    fontSize: fp(13),
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  notificationTime: {
    fontSize: fp(13),
    color: '#4D4D4D',
  },
  notificationText: {
    fontSize: fp(13),
    color: '#000000',
    lineHeight: fp(16),
    letterSpacing: -0.2,
  },
  mockList: {
    position: 'absolute',
    top: hp(154),
    left: wp(60),
    gap: hp(8),
  },
  mockListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: sp(15),
    padding: wp(8),
    width: wp(233),
    height: hp(42),
  },
  mockIconPlaceholder: {
    width: sp(24),
    height: sp(24),
    borderRadius: sp(6),
    backgroundColor: '#1D1D1F',
    marginRight: wp(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockTextLines: {
    flex: 1,
    gap: hp(4),
  },
  mockLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: wp(10),
  },
  mockLine: {
    height: hp(11),
    backgroundColor: '#DFDFDF',
    borderRadius: sp(64),
  },
  footerText: {
    fontSize: fp(15),
    color: 'rgba(29, 29, 31, 0.6)',
    textAlign: 'center',
    lineHeight: fp(20),
  },
  bottomButtons: {
    paddingHorizontal: wp(25),
    paddingBottom: hp(24),
    paddingTop: hp(24),
  },
  continueButton: {
    backgroundColor: '#212121',
    borderRadius: sp(99),
    height: hp(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
