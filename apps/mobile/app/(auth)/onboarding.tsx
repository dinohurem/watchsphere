import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

const TOTAL_STEPS = 4; // Registration steps (2) + Onboarding steps (2 shown as 3-4)

type Step = 1 | 2;

interface OnboardingData {
  firstName: string;
  lastName: string;
  gender: string;
  role: string;
}

const ROLES = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'collector', label: 'Collector' },
  { id: 'blogger', label: 'Blogger/Journalist' },
  { id: 'expert', label: 'Expert' },
  { id: 'private_seller', label: 'Private Seller' },
  { id: 'commercial_dealer', label: 'Commercial Dealer' },
];

const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Back Arrow Icon
function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth={2}>
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}

// Chevron Down Icon
function ChevronDown() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth={2}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

// Chevron Right Icon
function ChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth={2}>
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    gender: '',
    role: '',
  });

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      router.back();
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!data.firstName.trim() || !data.lastName.trim()) {
        Alert.alert('Error', 'Please fill in your first and last name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!data.role) {
        Alert.alert('Error', 'Please select your role');
        return;
      }
      await completeOnboarding();
    }
  };

  const handleRoleSelect = async (roleId: string) => {
    setData({ ...data, role: roleId });
    // Complete onboarding when role is selected
    setLoading(true);
    try {
      const response = await api.post('/auth/complete-onboarding', {
        first_name: data.firstName,
        last_name: data.lastName,
        gender: data.gender || undefined,
        role: roleId,
        watch_count: 0,
      });

      if (response.data.user) {
        setUser(response.data.user);
      }

      router.replace('/(auth)/notifications');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/complete-onboarding', {
        first_name: data.firstName,
        last_name: data.lastName,
        gender: data.gender || undefined,
        role: data.role,
        watch_count: 0,
      });

      if (response.data.user) {
        setUser(response.data.user);
      }

      // Go to notifications screen
      router.replace('/(auth)/notifications');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    // Map onboarding steps to overall progress (3/4, 4/4 for steps 1, 2)
    const progressMap: Record<Step, number> = {
      1: 3,
      2: 4,
    };
    const progress = progressMap[step] / TOTAL_STEPS;
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
      <Text style={styles.title}>Tell us who you are</Text>
      <Text style={styles.subtitle}>
        Add your name, last name, and optionally your gender to personalize your experience.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John"
            placeholderTextColor="#999999"
            value={data.firstName}
            onChangeText={(text) => setData({ ...data, firstName: text })}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Doe"
            placeholderTextColor="#999999"
            value={data.lastName}
            onChangeText={(text) => setData({ ...data, lastName: text })}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowGenderDropdown(true)}
          >
            <Text style={data.gender ? styles.dropdownText : styles.dropdownPlaceholder}>
              {GENDERS.find(g => g.id === data.gender)?.label || 'Select Gender (Optional)'}
            </Text>
            <ChevronDown />
          </TouchableOpacity>
        </View>
      </View>

      {/* Gender Selection Modal */}
      <Modal
        visible={showGenderDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderDropdown(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {GENDERS.map((gender) => (
              <TouchableOpacity
                key={gender.id}
                style={styles.modalOption}
                onPress={() => {
                  setData({ ...data, gender: gender.id });
                  setShowGenderDropdown(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  data.gender === gender.id && styles.modalOptionSelected
                ]}>
                  {gender.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>What kind of watch enthusiast are you?</Text>
      <Text style={styles.subtitle}>
        We would like to get to know you and your relationship with watches a bit better so we can provide you with more personalized content!
      </Text>

      <View style={styles.roleList}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={styles.roleCard}
            onPress={() => handleRoleSelect(role.id)}
          >
            <Text style={styles.roleLabel}>{role.label}</Text>
            <ChevronRight />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const canProceed = () => {
    if (step === 1) {
      return data.firstName.trim().length > 0 && data.lastName.trim().length > 0;
    }
    if (step === 2) {
      return data.role.length > 0;
    }
    return true;
  };

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
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

        {/* Bottom Button - not shown for step 2 (role selection auto-advances) */}
        {step !== 2 && (
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!canProceed() || loading) && styles.buttonDisabled
              ]}
              onPress={handleNext}
              disabled={!canProceed() || loading}
            >
              <Text style={styles.continueButtonText}>
                {loading ? 'Please wait...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  title: {
    fontSize: fp(34),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(8),
    letterSpacing: -0.6,
    lineHeight: fp(41),
  },
  subtitle: {
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
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    letterSpacing: 0.075,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: sp(999),
    height: hp(48),
    paddingHorizontal: wp(16),
    fontSize: fp(15),
    color: '#1D1D1F',
    backgroundColor: '#FFFFFF',
    letterSpacing: 0.075,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: '#1D1D1F',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: sp(999),
    height: hp(48),
    paddingHorizontal: wp(16),
  },
  dropdownText: {
    fontSize: fp(15),
    color: '#1D1D1F',
    letterSpacing: 0.075,
  },
  dropdownPlaceholder: {
    fontSize: fp(15),
    color: 'rgba(29, 29, 31, 0.5)',
    letterSpacing: 0.075,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(24),
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(16),
    width: '100%',
    maxWidth: wp(340),
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: fp(18),
    fontWeight: '600',
    color: '#1D1D1F',
    padding: wp(20),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalOption: {
    padding: wp(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalOptionText: {
    fontSize: fp(15),
    color: '#1D1D1F',
  },
  modalOptionSelected: {
    fontWeight: '600',
  },
  roleList: {
    gap: hp(8),
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp(16),
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
  },
  roleLabel: {
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
    backgroundColor: '#212121',
    borderRadius: sp(99),
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
