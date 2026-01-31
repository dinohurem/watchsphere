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
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import * as AppleAuthentication from 'expo-apple-authentication';

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

// Apple Logo Icon
function AppleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Focus states for inputs
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const login = useAuthStore((state) => state.login);

  const handleBack = () => {
    router.back();
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Get user name (only provided on first sign-in)
      let userName: string | undefined;
      if (credential.fullName?.givenName || credential.fullName?.familyName) {
        userName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');
      }

      // Send to backend
      const response = await api.post('/auth/apple', {
        id_token: credential.identityToken,
        user_name: userName,
      });

      const { user, access_token, refresh_token } = response.data;

      // Store tokens
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);

      login(user, access_token);

      // Check if notification prompt has been shown before
      const notificationPromptShown = await AsyncStorage.getItem('notification_prompt_shown');
      if (!notificationPromptShown) {
        router.replace('/(auth)/notifications');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, do nothing
        return;
      }

      const errorMessage = error.response?.data?.detail || 'Apple Sign In failed. Please try again.';
      Alert.alert('Sign In Failed', errorMessage);
    } finally {
      setAppleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { user, access_token, refresh_token } = response.data;

      // Store tokens
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);

      login(user, access_token);

      // Check if notification prompt has been shown before
      const notificationPromptShown = await AsyncStorage.getItem('notification_prompt_shown');
      if (!notificationPromptShown) {
        // Show notification screen if user hasn't seen it
        router.replace('/(auth)/notifications');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Please try again';

      // Check for pending approval error
      if (errorMessage.toLowerCase().includes('pending approval')) {
        Alert.alert(
          'Account Pending Approval',
          'Your account is awaiting admin approval. You will receive an email notification once your account has been reviewed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Login Failed', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const canLogin = email.length > 0 && password.length > 0;

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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to your WatchSphere account to continue.
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
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Password<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, passwordFocused && styles.inputFocused]}
                placeholder="********"
                placeholderTextColor="rgba(29, 29, 31, 0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                textContentType="oneTimeCode"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!canLogin || loading) && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={!canLogin || loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Apple Sign In Button */}
              <TouchableOpacity
                style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
                onPress={handleAppleSignIn}
                disabled={appleLoading}
              >
                <AppleLogo />
                <Text style={styles.appleButtonText}>
                  {appleLoading ? 'Signing in...' : 'Continue with Apple'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.legalFooter}>
            <Text style={styles.legalText}>By signing in, you agree to our </Text>
            <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)}>
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}> and </Text>
            <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
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
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  bottomButtons: {
    paddingHorizontal: wp(24),
    paddingBottom: hp(24),
    paddingTop: hp(16),
  },
  loginButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(16),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(29, 29, 31, 0.1)',
  },
  dividerText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: 'rgba(29, 29, 31, 0.5)',
    marginHorizontal: wp(12),
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: sp(999),
    height: hp(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
  },
  appleButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
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
  legalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(12),
  },
  legalText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(12),
    color: 'rgba(29, 29, 31, 0.5)',
  },
  legalLink: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    fontWeight: '500',
    color: 'rgba(29, 29, 31, 0.7)',
    textDecorationLine: 'underline',
  },
});
