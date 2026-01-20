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
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/services/api';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Back Arrow Icon
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

const CODE_LENGTH = 6;

export default function ResetVerifyCodeScreen() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || '';

  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Move to next input if digit entered
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      Alert.alert('Error', 'Please enter the complete verification code');
      return;
    }

    setLoading(true);

    // Navigate to new password screen with email and code
    router.push({
      pathname: '/(auth)/reset-new-password',
      params: { email, code: fullCode },
    } as any);

    setLoading(false);
  };

  const handleResendCode = async () => {
    setResending(true);

    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert('Success', 'A new verification code has been sent to your email');
    } catch (error: any) {
      // Still show success for security
      Alert.alert('Success', 'A new verification code has been sent to your email');
    } finally {
      setResending(false);
    }
  };

  const canSubmit = code.every((digit) => digit !== '');

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
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  focusedIndex === index && styles.codeInputFocused,
                  digit && styles.codeInputFilled,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResendCode} disabled={resending}>
              <Text style={[styles.resendLink, resending && styles.resendLinkDisabled]}>
                {resending ? 'Sending...' : 'Resend'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canSubmit || loading) && styles.buttonDisabled,
            ]}
            onPress={() => handleVerifyCode()}
            disabled={!canSubmit || loading}
          >
            <Text
              style={[
                styles.primaryButtonText,
                (!canSubmit || loading) && styles.buttonTextDisabled,
              ]}
            >
              {loading ? 'Verifying...' : 'Continue'}
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
    marginBottom: hp(40),
    letterSpacing: -0.43,
  },
  emailHighlight: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#1D1D1F',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: wp(8),
    marginBottom: hp(24),
  },
  codeInput: {
    flex: 1,
    height: sp(56),
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.1)',
    borderRadius: sp(12),
    fontSize: fp(24),
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
    color: '#1D1D1F',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  codeInputFocused: {
    borderWidth: 2,
    borderColor: '#1D1D1F',
  },
  codeInputFilled: {
    backgroundColor: 'rgba(29, 29, 31, 0.03)',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: 'rgba(29, 29, 31, 0.6)',
  },
  resendLink: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  resendLinkDisabled: {
    color: 'rgba(29, 29, 31, 0.4)',
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
});
