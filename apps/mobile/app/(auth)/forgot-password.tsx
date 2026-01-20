import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '@/services/api';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Back Arrow Icon (matches Figma design)
function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M12.5 15L7.5 10L12.5 5"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus state for input
  const [emailFocused, setEmailFocused] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      // Navigate to verification code screen
      router.push({
        pathname: '/(auth)/reset-verify-code',
        params: { email },
      } as any);
    } catch (error: any) {
      // Don't reveal if email exists or not for security
      // Always navigate to verification screen
      router.push({
        pathname: '/(auth)/reset-verify-code',
        params: { email },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <BackArrow />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email address<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                placeholder="johndoe.watches@gmail.com"
                placeholderTextColor="rgba(29, 29, 31, 0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canSubmit || loading) && styles.buttonDisabled
            ]}
            onPress={handleResetPassword}
            disabled={!canSubmit || loading}
          >
            <Text style={[
              styles.primaryButtonText,
              (!canSubmit || loading) && styles.buttonTextDisabled
            ]}>
              {loading ? 'Sending...' : 'Send verification code'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
  },
  backButton: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(296),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(24),
    paddingTop: hp(16),
    paddingBottom: hp(24),
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(34),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(8),
    letterSpacing: -0.6,
    lineHeight: fp(41),
  },
  subtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(17),
    color: 'rgba(29, 29, 31, 0.6)',
    lineHeight: fp(22),
    marginBottom: hp(32),
    letterSpacing: -0.43,
  },
  form: {
    gap: hp(20),
  },
  inputGroup: {
    gap: hp(8),
  },
  label: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    letterSpacing: 0.075,
  },
  requiredAsterisk: {
    color: '#FF3B30',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
    borderRadius: sp(999),
    height: hp(48),
    paddingHorizontal: wp(16),
    fontSize: fp(15),
    fontFamily: 'HankenGrotesk_400Regular',
    color: '#1D1D1F',
    backgroundColor: '#FFFFFF',
    letterSpacing: 0.075,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: '#1D1D1F',
  },
  bottomButtons: {
    paddingHorizontal: wp(24),
    paddingBottom: hp(24),
    paddingTop: hp(16),
  },
  primaryButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
  },
  buttonTextDisabled: {
    color: 'rgba(29, 29, 31, 0.4)',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(16),
  },
  footerText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: 'rgba(29, 29, 31, 0.6)',
  },
  footerLink: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    fontWeight: '600',
    color: '#1D1D1F',
  },
});
