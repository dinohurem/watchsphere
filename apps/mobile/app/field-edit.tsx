import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft } from '@/components/icons';

export default function FieldEditScreen() {
  const { colors } = useTheme();
  const { field } = useLocalSearchParams<{ field: string }>();
  const [value, setValue] = useState('Fabian Wir');

  const getFieldTitle = () => {
    switch (field) {
      case 'name':
        return 'Name';
      case 'contact':
        return 'Contact Information';
      default:
        return 'Edit Field';
    }
  };

  const getFieldPlaceholder = () => {
    switch (field) {
      case 'name':
        return 'Please enter your full name here.';
      case 'contact':
        return 'Please enter your contact information.';
      default:
        return 'Enter value';
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
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    backButton: {
      padding: 4,
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.text,
      marginBottom: 24,
    },
    input: {
      fontSize: 17,
      fontWeight: '400',
      color: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: 32,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
      marginTop: 'auto',
      marginBottom: 32,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
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
        >
          <ArrowLeft size={24} color={colors.text} />
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
          placeholder={getFieldPlaceholder()}
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => router.back()}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
