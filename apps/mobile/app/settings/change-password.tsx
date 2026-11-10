/** P6 – Change password: current, new, confirm; "At least 8 characters."; Forgot password? */
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UI } from '@/components/market/tokens';
import { SettingsHeader } from '@/components/settings/FormRows';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { fp, hp, sp, wp } from '@/utils/responsive';

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { fonts } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { fontFamily: fonts.regular }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={UI.greyLight}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { fontFamily: fonts.regular }, focused && styles.inputFocused]}
      />
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { fonts } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = current.length > 0 && next.length >= 8 && confirm.length > 0 && !saving;

  const submit = async () => {
    if (next !== confirm) {
      Alert.alert('Change password', 'The new passwords do not match.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Change password', 'At least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/profile/change-password', {
        current_password: current,
        new_password: next,
      });
      Alert.alert('Change password', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      Alert.alert(
        'Change password',
        typeof detail === 'string' ? detail : 'Could not update your password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title="Change password" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PasswordField label="Current password" value={current} onChange={setCurrent} />
          <PasswordField label="New password" value={next} onChange={setNext} />
          <PasswordField
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat new password"
          />
          <Text style={[styles.hint, { fontFamily: fonts.regular }]}>At least 8 characters.</Text>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password' as never)}
            style={styles.forgot}
          >
            <Text style={[styles.forgotText, { fontFamily: fonts.medium }]}>Forgot password?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, !canSubmit && { opacity: 0.4 }]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, { fontFamily: fonts.semiBold }]}>Update password</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingTop: hp(8) },
  field: { marginBottom: hp(14) },
  fieldLabel: { fontSize: fp(13), color: UI.grey, marginBottom: hp(6) },
  input: {
    height: sp(48),
    borderRadius: sp(12),
    backgroundColor: UI.fill,
    paddingHorizontal: wp(14),
    fontSize: fp(16),
    color: UI.text,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: { borderColor: UI.blue, backgroundColor: UI.white },
  hint: { fontSize: fp(13), color: UI.grey },
  footer: { paddingHorizontal: wp(16), paddingBottom: hp(8) },
  forgot: { alignSelf: 'center', paddingVertical: hp(10) },
  forgotText: { fontSize: fp(14), color: UI.blue },
  button: {
    height: sp(52),
    borderRadius: sp(26),
    backgroundColor: UI.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: UI.white, fontSize: fp(16) },
});
