import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
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

// Email Icon
function EmailIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 6L12 13L2 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Phone Icon
function PhoneIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9845 21.5573 21.2136 21.3521 21.4019C21.1469 21.5901 20.9046 21.7335 20.6408 21.8227C20.3769 21.9119 20.0974 21.9451 19.82 21.92C16.7428 21.5856 13.787 20.5341 11.19 18.85C8.77383 17.3147 6.72534 15.2662 5.19 12.85C3.49998 10.2412 2.44824 7.27099 2.12 4.18C2.09501 3.90347 2.12788 3.62476 2.2165 3.36162C2.30513 3.09849 2.44757 2.85669 2.63477 2.65162C2.82196 2.44655 3.04981 2.28271 3.30379 2.17052C3.55778 2.05833 3.83234 2.00026 4.11 2H7.11C7.59531 1.99522 8.06579 2.16708 8.43376 2.48353C8.80173 2.79999 9.04208 3.23945 9.11 3.72C9.23662 4.68007 9.47145 5.62273 9.81 6.53C9.94455 6.88792 9.97366 7.27691 9.89391 7.65088C9.81415 8.02485 9.62886 8.36811 9.36 8.64L8.09 9.91C9.51356 12.4135 11.5865 14.4864 14.09 15.91L15.36 14.64C15.6319 14.3711 15.9752 14.1858 16.3491 14.1061C16.7231 14.0263 17.1121 14.0555 17.47 14.19C18.3773 14.5286 19.3199 14.7634 20.28 14.89C20.7658 14.9585 21.2094 15.2032 21.5265 15.5775C21.8437 15.9518 22.0122 16.4296 22 16.92Z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Location Icon
function LocationIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="10"
        r="3"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Social Icons
function InstagramIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#1D1D1F" strokeWidth={1.5} />
      <Circle cx="12" cy="12" r="4" stroke="#1D1D1F" strokeWidth={1.5} />
      <Circle cx="18" cy="6" r="1" fill="#1D1D1F" />
    </Svg>
  );
}

function TwitterIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4L10.5 12.5M20 20L13.5 11.5M10.5 12.5L4 20H8L13.5 11.5M10.5 12.5L16 4H20L13.5 11.5"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LinkedInIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="2" width="20" height="20" rx="2" stroke="#1D1D1F" strokeWidth={1.5} />
      <Path d="M7 11V16" stroke="#1D1D1F" strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M7 7V7.01" stroke="#1D1D1F" strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M11 16V13C11 11.8954 11.8954 11 13 11C14.1046 11 15 11.8954 15 13V16"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M11 12V16" stroke="#1D1D1F" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// Chevron Right Icon
function ChevronRightIcon() {
  return (
    <Svg width={sp(16)} height={sp(16)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const SUPPORT_EMAIL = 'info@watchsphere.io';
const SUPPORT_PHONE = '+41 44 123 4567';

interface ContactItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function ContactItem({ icon, title, subtitle, onPress }: ContactItemProps) {
  return (
    <TouchableOpacity style={styles.contactItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.contactItemIcon}>{icon}</View>
      <View style={styles.contactItemContent}>
        <Text style={styles.contactItemTitle}>{title}</Text>
        <Text style={styles.contactItemSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

interface SocialButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
}

function SocialButton({ icon, onPress }: SocialButtonProps) {
  return (
    <TouchableOpacity style={styles.socialButton} onPress={onPress} activeOpacity={0.7}>
      {icon}
    </TouchableOpacity>
  );
}

export default function ContactScreen() {
  const { t } = useTranslation();

  const handleEmail = async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch (error) {
      Alert.alert(t('contact.error'), t('contact.couldNotOpenEmail'));
    }
  };

  const handlePhone = async () => {
    try {
      await Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`);
    } catch (error) {
      Alert.alert('Error', 'Could not open phone app');
    }
  };

  const handleLocation = async () => {
    try {
      const address = encodeURIComponent('123 Watch Street, Zurich, Switzerland');
      await Linking.openURL(`https://maps.apple.com/?q=${address}`);
    } catch (error) {
      Alert.alert('Error', 'Could not open maps');
    }
  };

  const handleSocialPress = (platform: string) => {
    const urls: Record<string, string> = {
      instagram: 'https://instagram.com/watchsphere',
      twitter: 'https://x.com/watchsphere',
      linkedin: 'https://linkedin.com/company/watchsphere',
    };

    Linking.openURL(urls[platform]).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
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
        <Text style={styles.headerTitle}>{t('contact.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Section */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>{t('contact.getInTouch')}</Text>
          <Text style={styles.introText}>
            {t('contact.intro')}
          </Text>
        </View>

        {/* Contact Options */}
        <View style={styles.contactList}>
          <ContactItem
            icon={<EmailIcon />}
            title={t('contact.emailUs')}
            subtitle={SUPPORT_EMAIL}
            onPress={handleEmail}
          />
          </View>
          {/* <ContactItem
            icon={<PhoneIcon />}
            title="Call Us"
            subtitle={SUPPORT_PHONE}
            onPress={handlePhone}
          />
          <ContactItem
            icon={<LocationIcon />}
            title="Visit Us"
            subtitle="123 Watch Street, Zurich, Switzerland"
            onPress={handleLocation}
          />
        </View>

        {/* Business Hours */}
        {/* <View style={styles.hoursSection}>
          <Text style={styles.hoursTitle}>Business Hours</Text>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Monday - Friday</Text>
            <Text style={styles.hoursTime}>9:00 AM - 6:00 PM CET</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Saturday</Text>
            <Text style={styles.hoursTime}>10:00 AM - 4:00 PM CET</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>Sunday</Text>
            <Text style={styles.hoursTime}>Closed</Text>
          </View>
        </View> */}

        {/* Social Media */}
        {/* <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>Follow Us</Text>
          <View style={styles.socialButtons}>
            <SocialButton
              icon={<InstagramIcon />}
              onPress={() => handleSocialPress('instagram')}
            />
            <SocialButton
              icon={<TwitterIcon />}
              onPress={() => handleSocialPress('twitter')}
            />
            <SocialButton
              icon={<LinkedInIcon />}
              onPress={() => handleSocialPress('linkedin')}
            />
          </View>
        </View> */}

        {/* Response Time Notice */}
        {/* <View style={styles.noticeSection}>
          <Text style={styles.noticeText}>
            We typically respond to all inquiries within 24-48 business hours.
          </Text>
        </View>  */}
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
  introSection: {
    marginBottom: hp(24),
  },
  introTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(8),
  },
  introText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    lineHeight: fp(22),
  },
  contactList: {
    gap: hp(12),
    marginBottom: hp(32),
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    padding: wp(16),
    gap: wp(12),
  },
  contactItemIcon: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(22),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactItemContent: {
    flex: 1,
  },
  contactItemTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(2),
  },
  contactItemSubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#666666',
  },
  hoursSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    padding: wp(16),
    marginBottom: hp(32),
  },
  hoursTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(12),
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(8),
  },
  hoursDay: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
  },
  hoursTime: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  socialSection: {
    marginBottom: hp(32),
  },
  socialTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(16),
    textAlign: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(16),
  },
  socialButton: {
    width: sp(52),
    height: sp(52),
    borderRadius: sp(26),
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeSection: {
    backgroundColor: 'rgba(33, 33, 33, 0.03)',
    borderRadius: sp(12),
    padding: wp(16),
  },
  noticeText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#999999',
    textAlign: 'center',
    lineHeight: fp(18),
  },
});
