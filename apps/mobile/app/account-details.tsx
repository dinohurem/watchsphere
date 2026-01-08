import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, ChevronRight } from '@/components/icons';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp } from '@/utils/responsive';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

export default function AccountDetailsScreen() {
  const { colors, fonts } = useTheme();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile/me');
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Use auth store data as fallback
      if (user) {
        setProfile({
          id: user.id,
          email: user.email,
          name: user.name,
          phone: null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Reload profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/profile/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to change password. Please check your current password and try again.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
    },
    backButton: {
      padding: sp(4),
      marginRight: wp(16),
    },
    headerTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titleSection: {
      paddingHorizontal: wp(16),
      paddingTop: hp(8),
      paddingBottom: hp(24),
    },
    title: {
      fontSize: fp(28),
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: hp(8),
    },
    subtitle: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: colors.text,
      lineHeight: fp(22),
    },
    fieldsSection: {
      paddingHorizontal: wp(16),
    },
    fieldItem: {
      paddingVertical: hp(20),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fieldLabel: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: hp(8),
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldValue: {
      fontSize: fp(17),
      fontFamily: fonts.regular,
      color: colors.text,
    },
    fieldPlaceholder: {
      fontSize: fp(17),
      fontFamily: fonts.regular,
      color: colors.textTertiary,
    },
    sectionTitle: {
      fontSize: fp(20),
      fontFamily: fonts.bold,
      color: colors.text,
      paddingHorizontal: wp(16),
      paddingTop: hp(32),
      paddingBottom: hp(16),
    },
    socialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(16),
      paddingHorizontal: wp(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    socialIconPlaceholder: {
      width: sp(24),
      height: sp(24),
      borderRadius: sp(12),
      backgroundColor: colors.backgroundSecondary,
      marginRight: wp(12),
    },
    socialText: {
      flex: 1,
      fontSize: fp(17),
      fontFamily: fonts.regular,
      color: colors.text,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sp(24),
      borderTopRightRadius: sp(24),
      padding: wp(24),
      paddingBottom: hp(40),
    },
    modalTitle: {
      fontSize: fp(20),
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: hp(24),
    },
    modalInput: {
      fontSize: fp(17),
      fontFamily: fonts.regular,
      color: colors.text,
      paddingVertical: hp(12),
      paddingHorizontal: wp(16),
      borderRadius: sp(12),
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: hp(16),
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: wp(12),
      marginTop: hp(8),
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: hp(14),
      borderRadius: sp(12),
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    modalCancelButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    modalSaveButton: {
      flex: 1,
      paddingVertical: hp(14),
      borderRadius: sp(12),
      backgroundColor: colors.text,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: wp(8),
    },
    modalSaveButtonDisabled: {
      opacity: 0.5,
    },
    modalSaveButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <BackArrow size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <BackArrow size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Account Details</Text>
          <Text style={styles.subtitle}>
            Manage your account settings and security preferences
          </Text>
        </View>

        {/* Account Fields */}
        <View style={styles.fieldsSection}>
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>E-mail Address</Text>
            <View style={styles.fieldRow}>
              <Text style={profile?.email ? styles.fieldValue : styles.fieldPlaceholder}>
                {profile?.email || 'No email set'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => setShowPasswordModal(true)}
          >
            <Text style={styles.fieldLabel}>Change password</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldPlaceholder}>••••••••</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Login with Google/Apple Section */}
        <Text style={styles.sectionTitle}>Login with Google/Apple</Text>

        <View>
          <TouchableOpacity style={styles.socialItem}>
            <View style={styles.socialIconPlaceholder} />
            <Text style={styles.socialText}>{profile?.email || 'Not connected'}</Text>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Current Password"
              placeholderTextColor={colors.textSecondary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="New Password"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={changingPassword}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, changingPassword && styles.modalSaveButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword && <ActivityIndicator size="small" color={colors.background} />}
                <Text style={styles.modalSaveButtonText}>
                  {changingPassword ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
