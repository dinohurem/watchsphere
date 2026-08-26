import { useState, useEffect } from 'react';
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

export default function LoginScreen() {
  // Two login modes: email + password, and passwordless. The WhatsApp number
  // identifies the account; the code itself is emailed, so the number is an
  // identifier, never a destination.
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  // Matches EMAIL_OTP_RESEND_COOLDOWN_SECONDS on the server.
  const RESEND_COOLDOWN_SECONDS = 60;
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  // Focus states for inputs
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [whatsappFocused, setWhatsappFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleBack = () => {
    router.back();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await api.post('/auth/login', params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { user, access_token, refresh_token } = response.data;

      // Store tokens
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);

      // Just call login — RootLayoutNav will handle navigation
      login(user, access_token);
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

  const handleSendWhatsappCode = async () => {
    if (!whatsappPhone) {
      Alert.alert('Error', 'Enter your WhatsApp number');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/passwordless/request-code', { whatsapp_phone: whatsappPhone });
      setCodeSent(true);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      // The response is deliberately identical for unknown numbers and never
      // names the address, so this message must leak neither.
      Alert.alert('Check your email', 'If that number has an account, we have emailed it a code.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not send the code');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsappLogin = async () => {
    if (whatsappCode.length !== 6) {
      Alert.alert('Error', 'Enter the 6 digit code');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/passwordless/verify-code', {
        whatsapp_phone: whatsappPhone,
        code: whatsappCode,
      });
      const { user, access_token, refresh_token } = response.data;
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('refresh_token', refresh_token);
      login(user, access_token);
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const canLogin =
    mode === 'password'
      ? email.length > 0 && password.length > 0
      : codeSent
        ? whatsappCode.length === 6
        : whatsappPhone.length > 0;

  const handlePrimaryPress = () => {
    if (mode === 'password') return handleLogin();
    return codeSent ? handleWhatsappLogin() : handleSendWhatsappCode();
  };

  const primaryLabel = loading
    ? 'Please wait...'
    : mode === 'password'
      ? 'Sign in'
      : codeSent
        ? 'Verify & sign in'
        : 'Email me a code';

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
            {/* Mode switch: password vs emailed sign-in code */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeOption, mode === 'password' && styles.modeOptionActive]}
                onPress={() => setMode('password')}
              >
                <Text style={[styles.modeText, mode === 'password' && styles.modeTextActive]}>
                  Email & password
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeOption, mode === 'code' && styles.modeOptionActive]}
                onPress={() => setMode('code')}
              >
                <Text style={[styles.modeText, mode === 'code' && styles.modeTextActive]}>
                  Sign-in code
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'code' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    WhatsApp number<Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, whatsappFocused && styles.inputFocused]}
                    placeholder="+387 61 123 456"
                    placeholderTextColor="rgba(29, 29, 31, 0.4)"
                    value={whatsappPhone}
                    onChangeText={setWhatsappPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="telephoneNumber"
                    editable={!codeSent}
                    onFocus={() => setWhatsappFocused(true)}
                    onBlur={() => setWhatsappFocused(false)}
                  />
                </View>

                {codeSent && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Verification code<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, codeFocused && styles.inputFocused]}
                      placeholder="123456"
                      placeholderTextColor="rgba(29, 29, 31, 0.4)"
                      value={whatsappCode}
                      onChangeText={setWhatsappCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      onFocus={() => setCodeFocused(true)}
                      onBlur={() => setCodeFocused(false)}
                    />
                    <View style={styles.codeActions}>
                      <TouchableOpacity onPress={() => { setCodeSent(false); setWhatsappCode(''); setResendTimer(0); }}>
                        <Text style={styles.forgotPasswordText}>Use a different number</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSendWhatsappCode}
                        disabled={resendTimer > 0 || loading}
                      >
                        <Text style={[styles.forgotPasswordText, resendTimer > 0 && styles.resendDisabled]}>
                          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!canLogin || loading) && styles.buttonDisabled
            ]}
            onPress={handlePrimaryPress}
            disabled={!canLogin || loading}
          >
            <Text style={styles.loginButtonText}>{primaryLabel}</Text>
          </TouchableOpacity>

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
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp(8),
  },
  resendDisabled: {
    color: 'rgba(29, 29, 31, 0.4)',
  },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 29, 31, 0.05)',
    borderRadius: sp(10),
    padding: sp(4),
    marginBottom: hp(20),
  },
  modeOption: {
    flex: 1,
    paddingVertical: hp(10),
    borderRadius: sp(8),
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    fontSize: fp(14),
    fontFamily: 'HankenGrotesk_400Regular',
    color: 'rgba(29, 29, 31, 0.5)',
  },
  modeTextActive: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#1D1D1F',
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
