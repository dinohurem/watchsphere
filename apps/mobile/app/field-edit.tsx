import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow } from '@/components/icons';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp } from '@/utils/responsive';

export default function FieldEditScreen() {
  const { colors, fonts } = useTheme();
  const { field, value: initialValue } = useLocalSearchParams<{ field: string; value?: string }>();
  const [value, setValue] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);
  const { user, setUser } = useAuthStore();

  const getFieldTitle = () => {
    switch (field) {
      case 'name':
        return 'Name';
      case 'phone':
        return 'Contact Information';
      case 'email':
        return 'Email Address';
      case 'whatsapp_phone':
        return 'WhatsApp Info';
      case 'telegram_username':
        return 'Telegram Info';
      default:
        return 'Edit Field';
    }
  };

  const getFieldPlaceholder = () => {
    switch (field) {
      case 'name':
        return 'Please enter your full name here.';
      case 'phone':
        return 'Please enter your phone number.';
      case 'email':
        return 'Please enter your email address.';
      case 'whatsapp_phone':
        return 'Please enter your WhatsApp phone number.';
      case 'telegram_username':
        return 'Please enter your Telegram username (with @).';
      default:
        return 'Enter value';
    }
  };

  const getInputPlaceholder = () => {
    switch (field) {
      case 'name':
        return 'Full Name';
      case 'phone':
        return '+1 234 567 8900';
      case 'email':
        return 'email@example.com';
      case 'whatsapp_phone':
        return '+1 234 567 8900';
      case 'telegram_username':
        return '@username';
      default:
        return 'Enter value';
    }
  };

  const getKeyboardType = () => {
    switch (field) {
      case 'phone':
      case 'whatsapp_phone':
        return 'phone-pad' as const;
      case 'email':
        return 'email-address' as const;
      default:
        return 'default' as const;
    }
  };

  const handleSave = async () => {
    if (!value.trim()) {
      Alert.alert('Error', 'Please enter a value');
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, string> = {};
      updateData[field] = value.trim();

      await api.patch('/profile/me', updateData);

      // Update the auth store if the name was changed
      if (field === 'name' && user) {
        setUser({
          ...user,
          name: value.trim(),
        });
      }

      router.back();
    } catch (error: any) {
      console.error('Error saving field:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to save changes. Please try again.'
      );
    } finally {
      setSaving(false);
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
    content: {
      flex: 1,
      paddingHorizontal: wp(16),
      paddingTop: hp(24),
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
      marginBottom: hp(24),
    },
    input: {
      fontSize: fp(17),
      fontFamily: fonts.regular,
      color: colors.text,
      paddingVertical: hp(12),
      paddingHorizontal: wp(16),
      borderRadius: sp(12),
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: hp(32),
    },
    saveButton: {
      paddingVertical: hp(16),
      borderRadius: sp(12),
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 'auto',
      marginBottom: hp(32),
      flexDirection: 'row',
      gap: wp(8),
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <BackArrow size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{getFieldTitle()}</Text>
        <Text style={styles.subtitle}>{getFieldPlaceholder()}</Text>

        {/* Input */}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder={getInputPlaceholder()}
          placeholderTextColor={colors.textSecondary}
          autoFocus
          keyboardType={getKeyboardType()}
          autoCapitalize={field === 'email' ? 'none' : 'words'}
          autoCorrect={false}
          editable={!saving}
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving && <ActivityIndicator size="small" color={colors.background} />}
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
