import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, ChevronRight, User } from '@/components/icons';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp } from '@/utils/responsive';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  telegram_username: string | null;
  profile_image_url: string | null;
  profile_image_thumbnail_url: string | null;
}

export default function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const { colors, fonts } = useTheme();
  const { user, updateUser } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile/me');
      console.log('Profile Settings - API response:', JSON.stringify(response.data, null, 2));
      console.log('Profile Settings - profile_image_url:', response.data?.profile_image_url);
      setProfile(response.data);
      // Sync profile data to auth store for global access
      updateUser({
        name: response.data.name,
        profile_image_url: response.data.profile_image_url,
        profile_image_thumbnail_url: response.data.profile_image_thumbnail_url,
        phone: response.data.phone,
        whatsapp_phone: response.data.whatsapp_phone,
        telegram_username: response.data.telegram_username,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      // Use auth store data as fallback
      if (user) {
        setProfile({
          id: user.id,
          email: user.email,
          name: user.name,
          phone: null,
          whatsapp_phone: null,
          telegram_username: null,
          profile_image_url: null,
          profile_image_thumbnail_url: null,
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

  const handleUploadPhoto = async () => {
    try {
      // Request permission
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('profileSettings.permissionRequired'), t('profileSettings.photoLibraryPermission'));
          return;
        }
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const selectedImage = result.assets[0];
      setUploading(true);

      // Create form data for upload
      const formData = new FormData();
      const uri = selectedImage.uri;
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      // Upload to server
      const response = await api.post('/upload/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload response:', JSON.stringify(response.data, null, 2));

      if (response.data) {
        console.log('New profile image URL:', response.data.url);
        // Update local profile with new image URL
        setProfile(prev => prev ? {
          ...prev,
          profile_image_url: response.data.url,
          profile_image_thumbnail_url: response.data.thumbnail_url,
        } : null);
        // Sync to auth store for global access
        updateUser({
          profile_image_url: response.data.url,
          profile_image_thumbnail_url: response.data.thumbnail_url || response.data.url,
        });

        Alert.alert(t('common.success'), t('profileSettings.photoUpdatedSuccess'));
      }
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert(
        t('profileSettings.uploadFailed'),
        error.response?.data?.detail || t('profileSettings.uploadFailedMessage')
      );
    } finally {
      setUploading(false);
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
    profileImageSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(20),
      gap: wp(16),
    },
    profileImage: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(40),
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    profileImageActual: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(40),
    },
    uploadButton: {
      paddingVertical: hp(12),
      paddingHorizontal: wp(24),
      borderRadius: sp(12),
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    uploadButtonText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: colors.text,
    },
    fieldsSection: {
      paddingHorizontal: wp(16),
      paddingTop: hp(20),
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
          <Text style={styles.headerTitle}>{t('profileSettings.title')}</Text>
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
        <Text style={styles.headerTitle}>{t('profileSettings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t('profileSettings.title')}</Text>
          <Text style={styles.subtitle}>
            {t('profileSettings.subtitle')}
          </Text>
        </View>

        {/* Profile Image */}
        <View style={styles.profileImageSection}>
          <View style={styles.profileImage}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : profile?.profile_image_url ? (
              <Image
                source={{ uri: profile.profile_image_url }}
                style={styles.profileImageActual}
              />
            ) : (
              <User size={40} color={colors.textSecondary} />
            )}
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadPhoto}
            disabled={uploading}
          >
            <Text style={styles.uploadButtonText}>
              {uploading ? t('profileSettings.uploading') : t('profileSettings.uploadPhoto')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <View style={styles.fieldsSection}>
          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push({
              pathname: '/field-edit',
              params: { field: 'name', value: profile?.name || '' }
            } as any)}
          >
            <Text style={styles.fieldLabel}>{t('profileSettings.name')}</Text>
            <View style={styles.fieldRow}>
              <Text style={profile?.name ? styles.fieldValue : styles.fieldPlaceholder}>
                {profile?.name || t('profileSettings.enterName')}
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push({
              pathname: '/field-edit',
              params: { field: 'phone', value: profile?.phone || '' }
            } as any)}
          >
            <Text style={styles.fieldLabel}>{t('profileSettings.contactInfo')}</Text>
            <View style={styles.fieldRow}>
              <Text style={profile?.phone ? styles.fieldValue : styles.fieldPlaceholder}>
                {profile?.phone || t('profileSettings.enterPhone')}
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push({
              pathname: '/field-edit',
              params: { field: 'whatsapp_phone', value: profile?.whatsapp_phone || '' }
            } as any)}
          >
            <Text style={styles.fieldLabel}>{t('profileSettings.whatsappInfo')}</Text>
            <View style={styles.fieldRow}>
              <Text style={profile?.whatsapp_phone ? styles.fieldValue : styles.fieldPlaceholder}>
                {profile?.whatsapp_phone || t('profileSettings.enterWhatsapp')}
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push({
              pathname: '/field-edit',
              params: { field: 'telegram_username', value: profile?.telegram_username || '' }
            } as any)}
          >
            <Text style={styles.fieldLabel}>{t('profileSettings.telegramInfo')}</Text>
            <View style={styles.fieldRow}>
              <Text style={profile?.telegram_username ? styles.fieldValue : styles.fieldPlaceholder}>
                {profile?.telegram_username || t('profileSettings.enterTelegram')}
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
