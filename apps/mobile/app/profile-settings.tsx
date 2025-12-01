import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, ChevronRight, User } from '@/components/icons';

export default function ProfileSettingsScreen() {
  const { colors, fonts } = useTheme();

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
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    titleSection: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
    },
    title: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.text,
      lineHeight: 22,
    },
    profileImageSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 20,
      gap: 16,
    },
    profileImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    uploadButtonText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    fieldsSection: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    fieldItem: {
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fieldLabel: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldValue: {
      fontSize: 17,
      fontFamily: fonts.regular,
      color: colors.text,
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
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Profile Settings</Text>
          <Text style={styles.subtitle}>
            Manage your personal information and contact preferences
          </Text>
        </View>

        {/* Profile Image */}
        <View style={styles.profileImageSection}>
          <View style={styles.profileImage}>
            <User size={40} color={colors.textSecondary} />
          </View>
          <TouchableOpacity style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>Upload Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <View style={styles.fieldsSection}>
          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push('/field-edit?field=name' as any)}
          >
            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>Fabian Wirtz</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fieldItem}
            onPress={() => router.push('/field-edit?field=contact' as any)}
          >
            <Text style={styles.fieldLabel}>Contact information</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>+41 21 234 5678</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
