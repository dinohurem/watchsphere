import { useState, useRef, useEffect } from 'react';
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
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';

const TOTAL_STEPS = 4; // Account creation, WhatsApp verification, Personal info (handled in onboarding)

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

// Check Icon
function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={checked ? '#1D1D1F' : '#CCCCCC'}>
      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </Svg>
  );
}

type Step = 1 | 2;

interface PasswordValidation {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>(1);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  // Matches EMAIL_OTP_RESEND_COOLDOWN_SECONDS on the server.
  const RESEND_COOLDOWN_SECONDS = 60;
  const [resendTimer, setResendTimer] = useState(0);

  // Focus states for all inputs
  const [whatsappFocused, setWhatsappFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [repeatPasswordFocused, setRepeatPasswordFocused] = useState(false);

  const login = useAuthStore((state) => state.login);

  // Refs for verification code inputs
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Password validation
  const validatePassword = (pwd: string): PasswordValidation => ({
    minLength: pwd.length >= 8,
    hasLetter: /[a-zA-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
  });

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === repeatPassword && repeatPassword.length > 0;

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newCode = verificationCode.split('');
    newCode[index] = value;
    setVerificationCode(newCode.join(''));

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep(1);
    }
  };

  const handleCreateAccount = async () => {
    if (!whatsappPhone || !email || !password || !repeatPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Error', 'Please ensure your password meets all requirements');
      return;
    }

    if (password !== repeatPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create account - this sends the verification code over WhatsApp
      const response = await api.post('/auth/register', {
        whatsapp_phone: whatsappPhone,
        email,
        password,
      });

      // Store tokens from registration response so we can verify the number
      const { access_token, refresh_token } = response.data;
      if (access_token) {
        await AsyncStorage.setItem('auth_token', access_token);
      }
      if (refresh_token) {
        await AsyncStorage.setItem('refresh_token', refresh_token);
      }

      // Move to verification step
      setStep(2);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      Alert.alert(
        'Registration Failed',
        error.response?.data?.detail || 'Please try again'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);

    try {
      // Verify the WhatsApp code. This both confirms the number and returns
      // session tokens, so no follow-up password login is needed.
      const verifyResponse = await api.post('/auth/passwordless/verify-code', {
        whatsapp_phone: whatsappPhone,
        code: verificationCode,
      });

      const { user, access_token, refresh_token } = verifyResponse.data;

      if (user && access_token) {
        // Store tokens
        await AsyncStorage.setItem('auth_token', access_token);
        await AsyncStorage.setItem('refresh_token', refresh_token);

        // Just call login — RootLayoutNav will handle navigation
        login(user, access_token);
      } else {
        Alert.alert('Error', 'Verification failed. Please try again.');
      }
    } catch (error: any) {
      Alert.alert(
        'Verification Failed',
        error.response?.data?.detail || 'Invalid code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    try {
      await api.post('/auth/passwordless/request-code', { whatsapp_phone: whatsappPhone });
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Success', 'Verification code resent!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resend code');
    }
  };

  const renderProgressBar = () => {
    const progress = step / TOTAL_STEPS;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
    );
  };

  const renderStep1 = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>
        Set your WhatsApp number, email and password to continue.
      </Text>

      <View style={styles.form}>
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
            onFocus={() => setWhatsappFocused(true)}
            onBlur={() => setWhatsappFocused(false)}
          />
          <Text style={styles.fieldHint}>
            Include your country code. This is how dealers reach you.
          </Text>
        </View>

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
            style={[styles.input, passwordFocused && styles.inputFocused, !passwordFocused && password.length > 0 && !isPasswordValid && styles.inputError]}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Repeat Password<Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, repeatPasswordFocused && styles.inputFocused, !repeatPasswordFocused && repeatPassword.length > 0 && !passwordsMatch && styles.inputError]}
            placeholder="Please repeat your password"
            placeholderTextColor="rgba(29, 29, 31, 0.4)"
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            textContentType="oneTimeCode"
            onFocus={() => setRepeatPasswordFocused(true)}
            onBlur={() => setRepeatPasswordFocused(false)}
          />
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Your password must contain:</Text>

          <View style={styles.requirementRow}>
            <CheckIcon checked={passwordValidation.minLength} />
            <Text style={[
              styles.requirementText,
              passwordValidation.minLength && styles.requirementMet
            ]}>
              At least <Text style={styles.requirementBold}>8 characters</Text>
            </Text>
          </View>

          <View style={styles.requirementRow}>
            <CheckIcon checked={passwordValidation.hasLetter} />
            <Text style={[
              styles.requirementText,
              passwordValidation.hasLetter && styles.requirementMet
            ]}>
              Includes <Text style={styles.requirementBold}>one letter</Text>
            </Text>
          </View>

          <View style={styles.requirementRow}>
            <CheckIcon checked={passwordValidation.hasNumber} />
            <Text style={[
              styles.requirementText,
              passwordValidation.hasNumber && styles.requirementMet
            ]}>
              Includes <Text style={styles.requirementBold}>one number</Text>
            </Text>
          </View>

          <View style={styles.requirementRow}>
            <CheckIcon checked={passwordsMatch} />
            <Text style={[
              styles.requirementText,
              passwordsMatch && styles.requirementMet
            ]}>
              <Text style={styles.requirementBold}>Passwords</Text> match
            </Text>
          </View>
        </View>

        {/* Terms and Privacy Notice */}
        <View style={styles.legalNotice}>
          <Text style={styles.legalText}>By creating an account, you agree to our </Text>
          <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)}>
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}> and </Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>
        Enter the 6 digit code we sent to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>

      <View style={styles.codeContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <TextInput
            key={index}
            ref={(el) => { codeInputRefs.current[index] = el; }}
            style={[
              styles.codeInput,
              verificationCode[index] ? styles.codeInputFilled : null
            ]}
            maxLength={1}
            keyboardType="number-pad"
            value={verificationCode[index] || ''}
            onChangeText={(value) => handleCodeChange(index, value)}
            onKeyPress={({ nativeEvent }) => handleCodeKeyPress(index, nativeEvent.key)}
          />
        ))}
      </View>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't get the code? </Text>
        {resendTimer > 0 ? (
          <Text style={styles.resendTimerText}>
            Resend in 00:{resendTimer.toString().padStart(2, '0')}
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResendCode}>
            <Text style={styles.resendLink}>Resend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const canProceed = step === 1
    ? isPasswordValid && passwordsMatch && email.length > 0 && whatsappPhone.length > 0
    : verificationCode.length === 6;

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {step === 1 ? renderStep1() : renderStep2()}

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!canProceed || loading) && styles.buttonDisabled
            ]}
            onPress={step === 1 ? handleCreateAccount : handleVerifyCode}
            disabled={!canProceed || loading}
          >
            <Text style={styles.continueButtonText}>
              {loading ? 'Please wait...' : step === 1 ? 'Create Account' : 'Continue'}
            </Text>
          </TouchableOpacity>
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
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
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
  stepContent: {
    flex: 1,
    paddingHorizontal: wp(24),
    paddingTop: hp(16),
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
  emailHighlight: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
    color: '#1D1D1F',
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
  fieldHint: {
    fontSize: fp(12),
    fontFamily: 'HankenGrotesk_400Regular',
    color: 'rgba(29, 29, 31, 0.5)',
    marginTop: hp(6),
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
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  requirementsContainer: {
    marginTop: hp(16),
    gap: hp(12),
  },
  requirementsTitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#1D1D1F',
    marginBottom: hp(4),
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
  },
  requirementText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
  },
  requirementMet: {
    color: '#1D1D1F',
  },
  requirementBold: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(24),
    gap: wp(8),
  },
  codeInput: {
    width: (SCREEN_WIDTH - wp(48) - wp(40)) / 6,
    height: sp(54),
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
    borderRadius: sp(16),
    fontSize: fp(24),
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
    color: '#1D1D1F',
    backgroundColor: '#FAFAFA',
  },
  codeInputFilled: {
    borderWidth: 2,
    borderColor: '#1D1D1F',
    backgroundColor: '#FFFFFF',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
  },
  resendTimerText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: 'rgba(29, 29, 31, 0.5)',
  },
  resendLink: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  bottomButtons: {
    paddingHorizontal: wp(24),
    paddingBottom: hp(24),
    paddingTop: hp(16),
  },
  continueButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(999),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
  },
  legalNotice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: hp(24),
  },
  legalText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(12),
    color: 'rgba(29, 29, 31, 0.5)',
    lineHeight: fp(18),
  },
  legalLink: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    fontWeight: '500',
    color: 'rgba(29, 29, 31, 0.7)',
    textDecorationLine: 'underline',
    lineHeight: fp(18),
  },
});
