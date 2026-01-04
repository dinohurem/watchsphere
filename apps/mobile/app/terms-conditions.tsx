import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

export default function TermsConditionsScreen() {
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
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: January 2025</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionText}>
            By accessing or using WatchSphere, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services. We reserve the right to modify these terms at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. User Accounts</Text>
          <Text style={styles.sectionText}>
            To access certain features, you must create an account. You are responsible for:{'\n\n'}
            • Maintaining the confidentiality of your account{'\n'}
            • All activities that occur under your account{'\n'}
            • Providing accurate and complete information{'\n'}
            • Notifying us of any unauthorized access
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Marketplace Rules</Text>
          <Text style={styles.sectionText}>
            When using our marketplace:{'\n\n'}
            • All listings must be accurate and truthful{'\n'}
            • You must have legal right to sell listed items{'\n'}
            • Prices must be in good faith{'\n'}
            • Counterfeits and stolen goods are strictly prohibited{'\n'}
            • All transactions are between buyers and sellers
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Prohibited Activities</Text>
          <Text style={styles.sectionText}>
            You agree not to:{'\n\n'}
            • Violate any applicable laws or regulations{'\n'}
            • Infringe on intellectual property rights{'\n'}
            • Post false, misleading, or fraudulent content{'\n'}
            • Harass, threaten, or abuse other users{'\n'}
            • Attempt to gain unauthorized access{'\n'}
            • Use the service for money laundering
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Transaction Terms</Text>
          <Text style={styles.sectionText}>
            • WatchSphere facilitates connections between buyers and sellers{'\n'}
            • We are not a party to transactions between users{'\n'}
            • Users are responsible for verifying authenticity{'\n'}
            • Payment terms are agreed between parties{'\n'}
            • We may charge service fees for certain transactions
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Intellectual Property</Text>
          <Text style={styles.sectionText}>
            All content, features, and functionality of WatchSphere are owned by us and are protected by international copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.sectionText}>
            WatchSphere is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service. Our total liability shall not exceed the amount you paid us in the past 12 months.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Indemnification</Text>
          <Text style={styles.sectionText}>
            You agree to indemnify and hold harmless WatchSphere and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the service or violation of these terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Termination</Text>
          <Text style={styles.sectionText}>
            We may terminate or suspend your account at any time for any reason, including violation of these terms. Upon termination, your right to use the service will immediately cease. Provisions that by their nature should survive termination will survive.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Dispute Resolution</Text>
          <Text style={styles.sectionText}>
            Any disputes arising from these terms shall be resolved through binding arbitration in accordance with the rules of the Swiss Arbitration Association. The arbitration shall take place in Zurich, Switzerland, and the language shall be English.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Governing Law</Text>
          <Text style={styles.sectionText}>
            These terms shall be governed by and construed in accordance with the laws of Switzerland, without regard to its conflict of law provisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Information</Text>
          <Text style={styles.sectionText}>
            For questions about these Terms and Conditions, please contact us at:{'\n\n'}
            Email: legal@watchsphere.com{'\n'}
            Address: WatchSphere Inc., 123 Watch Street, Zurich, Switzerland
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  headerSpacer: {
    width: sp(44),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
    paddingBottom: hp(40),
  },
  lastUpdated: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#999999',
    marginBottom: hp(24),
  },
  section: {
    marginBottom: hp(24),
  },
  sectionTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(8),
  },
  sectionText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
    lineHeight: fp(22),
  },
});
