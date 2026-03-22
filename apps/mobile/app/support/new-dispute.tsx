import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { api } from '@/services/api';
import { useTranslation } from 'react-i18next';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function NewDisputeScreen() {
  const { t } = useTranslation();
  const [watchReference, setWatchReference] = useState('');
  const [watchBrand, setWatchBrand] = useState('');
  const [watchModel, setWatchModel] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!watchReference.trim()) {
      Alert.alert(t('common.error'), t('support.pleaseEnterWatchReference'));
      return;
    }

    if (!description.trim()) {
      Alert.alert(t('common.error'), t('support.pleaseEnterDisputeDescription'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/support/disputes', {
        watch_reference: watchReference.trim(),
        watch_brand: watchBrand.trim() || null,
        watch_model: watchModel.trim() || null,
        description: description.trim(),
      });

      Alert.alert(
        t('support.disputeSubmitted'),
        t('support.disputeSubmittedDesc'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error submitting dispute:', error);
      Alert.alert(
        t('common.error'),
        error.response?.data?.detail || t('support.failedToSubmitDispute')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = watchReference.trim() && description.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          disabled={submitting}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('support.newDispute')}</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{t('support.fileDispute')}</Text>
            <Text style={styles.subtitle}>
              {t('support.fileDisputeDesc')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('support.watchReference')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('support.watchReferencePlaceholder')}
                placeholderTextColor="#999999"
                value={watchReference}
                onChangeText={setWatchReference}
                autoCapitalize="characters"
                editable={!submitting}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('support.brandOptional')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('support.brandPlaceholder')}
                placeholderTextColor="#999999"
                value={watchBrand}
                onChangeText={setWatchBrand}
                autoCapitalize="words"
                editable={!submitting}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('support.modelOptional')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('support.modelPlaceholder')}
                placeholderTextColor="#999999"
                value={watchModel}
                onChangeText={setWatchModel}
                autoCapitalize="words"
                editable={!submitting}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('support.description')} *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('support.descriptionPlaceholder')}
                placeholderTextColor="#999999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!submitting}
                returnKeyType="done"
                blurOnSubmit
              />
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer} onTouchStart={Keyboard.dismiss}>
          <TouchableOpacity
            style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
            onPress={() => {
              Keyboard.dismiss();
              handleSubmit();
            }}
            disabled={!isValid || submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <LoadingAnimation size="small" />
            ) : (
              <Text style={styles.submitButtonText}>{t('support.submitDispute')}</Text>
            )}
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
    justifyContent: 'space-between',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
  },
  titleSection: {
    marginBottom: hp(24),
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(24),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(31),
  },
  subtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    marginTop: hp(8),
    lineHeight: fp(20),
  },
  form: {
    gap: hp(16),
  },
  inputGroup: {
    gap: hp(8),
  },
  inputLabel: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: sp(12),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#1D1D1F',
  },
  textArea: {
    minHeight: hp(140),
    paddingTop: hp(14),
  },
  footer: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 33, 33, 0.05)',
  },
  submitButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(12),
    paddingVertical: hp(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(33, 33, 33, 0.3)',
  },
  submitButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
