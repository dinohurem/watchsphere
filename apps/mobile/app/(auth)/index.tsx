import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, G, Rect } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

// WatchSphere Logo matching Figma design (77x64)
function WSLogo() {
  return (
    <View style={styles.logoContainer}>
      <Svg width={sp(77)} height={sp(64)} viewBox="0 0 77 64" fill="none">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M47.6224 29.5414H56.6389L58.6424 18.4562H63.6571L61.6535 29.5414H63.6718C70.6808 29.5416 76.3636 35.2013 76.3636 42.182C76.3635 49.1627 70.6807 54.8225 63.6718 54.8227H57.0851L55.4266 64H48.8347L47.1762 54.8227H30.7972L29.1387 64H22.5468L20.8883 54.8227H0.285159V49.9047H52.9591L55.7502 34.4586H48.5111L50.5146 45.5453H45.4984L40.6027 18.4562H45.6189L47.6224 29.5414ZM57.9738 49.9047H63.6718C67.9545 49.9045 71.4271 46.4475 71.4273 42.182C71.4273 37.9165 67.9546 34.4588 63.6718 34.4586H60.7648L57.9738 49.9047Z"
          fill="#1D1D1F"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M17.6533 9.17733H34.0322L35.6907 0H42.2826L43.9412 9.17733H60.3201L61.9786 0H66.9933L65.3348 9.17733H76.3636V14.0953H18.542L21.3345 29.5414H30.351L32.3545 18.4562H37.3707L32.4749 45.5453H27.4588L29.4623 34.4586H22.2232L24.2267 45.5453H19.2106L17.2071 34.4586H12.6903C5.68145 34.4583 0 28.7987 0 21.818C9.25611e-05 14.8545 5.65354 9.20536 12.6386 9.17733L10.9801 0H15.9948L17.6533 9.17733ZM13.5273 14.0953C9.02479 14.0953 4.93572 16.969 4.93562 21.818C4.93562 26.0834 8.40768 29.5411 12.6903 29.5414H16.3184L13.5273 14.0953Z"
          fill="#1D1D1F"
        />
      </Svg>
    </View>
  );
}

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Main Content - Centered */}
        <View style={styles.mainContent}>
          {/* Logo */}
          <WSLogo />

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to</Text>
            <Text style={styles.welcomeTitle}>WatchSphere</Text>
            <Text style={styles.welcomeSubtitle}>
              Trade smarter. Track better.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Sign Up Button */}
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>

            {/* Log In Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Links - Fixed at bottom */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)}>
            <Text style={styles.footerLink}>Terms and Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/contact' as any)}>
            <Text style={styles.footerLink}>Contact</Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
    paddingHorizontal: wp(24),
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: hp(40),
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: hp(48),
  },
  welcomeTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(34),
    fontWeight: '700',
    color: '#1D1D1F',
    textAlign: 'center',
    lineHeight: fp(41),
    letterSpacing: -0.4,
  },
  welcomeSubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(16),
    color: 'rgba(33, 33, 33, 0.8)',
    textAlign: 'center',
    lineHeight: fp(24),
    marginTop: hp(16),
    paddingHorizontal: wp(8),
  },
  buttonsContainer: {
    width: '100%',
    gap: hp(12),
  },
  signUpButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
  },
  loginButtonText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(16),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: wp(24),
    paddingBottom: hp(16),
  },
  footerLink: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    fontWeight: '400',
    color: 'rgba(0, 0, 0, 0.7)',
  },
});
