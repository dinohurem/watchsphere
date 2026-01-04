import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

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

interface LegalItemProps {
  title: string;
  onPress: () => void;
}

function LegalItem({ title, onPress }: LegalItemProps) {
  return (
    <TouchableOpacity
      style={styles.legalItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.legalItemText}>{title}</Text>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

export default function TermsPrivacyScreen() {
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
          <Text style={styles.title}>Terms and Privacy</Text>
          <Text style={styles.subtitle}>
            Review our legal documents and get in touch with us
          </Text>
        </View>

        {/* Legal Items */}
        <View style={styles.legalList}>
          <LegalItem
            title="Privacy Policy"
            onPress={() => router.push('/privacy-policy' as any)}
          />
          <LegalItem
            title="Terms and Conditions"
            onPress={() => router.push('/terms-conditions' as any)}
          />
          <LegalItem
            title="Contact Us"
            onPress={() => router.push('/contact' as any)}
          />
        </View>

        {/* Info Text */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            By using WatchSphere, you agree to our Terms and Conditions and Privacy Policy.
          </Text>
          <Text style={styles.versionText}>
            Version 1.0.0
          </Text>
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
  subtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    marginTop: hp(8),
    lineHeight: fp(20),
  },
  legalList: {
    gap: hp(8),
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  legalItemText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
  },
  infoSection: {
    marginTop: hp(32),
    paddingHorizontal: wp(8),
  },
  infoText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#999999',
    textAlign: 'center',
    lineHeight: fp(18),
  },
  versionText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(12),
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: hp(16),
  },
});
