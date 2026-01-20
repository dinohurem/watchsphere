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

// Eye Icon (show password)
function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Eye Off Icon (hide password)
function EyeOffIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2047 20.84 15.19M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.4811 9.80385 14.1962C9.51897 13.9113 9.29439 13.572 9.14351 13.1984C8.99262 12.8249 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2219 9.18488 10.8539C9.34884 10.4859 9.58525 10.1547 9.88 9.88"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1L23 23"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Check Icon
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ResetNewPasswordScreen() {
  const params = useLocalSearchParams<{ email: string; code: string }>();
  const email = params.email || '';
  const code = params.code || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Focus states
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const handleBack = () => {
    router.back();
  };

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const canSubmit = isPasswordValid && passwordsMatch;

  const handleResetPassword = async () => {
    if (!canSubmit) {
      if (!isPasswordValid) {
        Alert.alert('Error', 'Please ensure your password meets all requirements');
        return;
      }
      if (!passwordsMatch) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        email,
        code,
        new_password: password,
      });

      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. You can now sign in with your new password.',
        [
          {
            text: 'Sign in',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to reset password. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordRequirement = (met: boolean, text: string) => (
    <View style={styles.requirementRow}>
      <CheckIcon color={met ? '#4AA078' : 'rgba(29, 29, 31, 0.2)'} />
      <Text style={[styles.requirementText, met && styles.requirementMet]}>{text}</Text>
    </View>
  );

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
          <Text style={styles.title}>Create new password</Text>
          <Text style={styles.subtitle}>
            Your new password must be different from previously used passwords.
          </Text>

          <View style={styles.form}>
            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                New password<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="rgba(29, 29, 31, 0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirements}>
              {renderPasswordRequirement(hasMinLength, 'At least 8 characters')}
              {renderPasswordRequirement(hasUppercase, 'One uppercase letter')}
              {renderPasswordRequirement(hasLowercase, 'One lowercase letter')}
              {renderPasswordRequirement(hasNumber, 'One number')}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Confirm password<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputContainer, confirmPasswordFocused && styles.inputContainerFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="rgba(29, 29, 31, 0.4)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  <CheckIcon color={passwordsMatch ? '#4AA078' : '#FF3B30'} />
                  <Text style={[styles.matchText, passwordsMatch ? styles.matchSuccess : styles.matchError]}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={!canSubmit || loading}
          >
            <Text style={[styles.primaryButtonText, (!canSubmit || loading) && styles.buttonTextDisabled]}>
              {loading ? 'Resetting...' : 'Reset password'}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29, 29, 31, 0.05)',
    borderRadius: sp(999),
    height: hp(48),
    backgroundColor: '#FFFFFF',
  },
  inputContainerFocused: {
    borderWidth: 2,
    borderColor: '#1D1D1F',
  },
  input: {
    flex: 1,
    paddingHorizontal: wp(16),
    fontSize: fp(15),
    fontFamily: 'HankenGrotesk_400Regular',
    color: '#1D1D1F',
    letterSpacing: 0.075,
  },
  eyeButton: {
    paddingHorizontal: wp(16),
    height: '100%',
    justifyContent: 'center',
  },
  requirements: {
    gap: hp(8),
    paddingVertical: hp(4),
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
  },
  requirementText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: 'rgba(29, 29, 31, 0.5)',
  },
  requirementMet: {
    color: '#4AA078',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
    marginTop: hp(4),
  },
  matchText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
  },
  matchSuccess: {
    color: '#4AA078',
  },
  matchError: {
    color: '#FF3B30',
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
