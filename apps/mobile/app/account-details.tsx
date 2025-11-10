import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, ChevronRight } from '@/components/icons';

export default function AccountDetailsScreen() {
  const { colors } = useTheme();

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
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.text,
      lineHeight: 22,
    },
    fieldsSection: {
      paddingHorizontal: 16,
    },
    fieldItem: {
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '400',
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
      fontWeight: '400',
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 16,
      paddingTop: 32,
      paddingBottom: 16,
    },
    socialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    socialIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: 12,
    },
    socialIconPlaceholder: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      marginRight: 12,
    },
    socialText: {
      flex: 1,
      fontSize: 17,
      fontWeight: '400',
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
        <Text style={styles.headerTitle}>Account Details</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Account Details</Text>
          <Text style={styles.subtitle}>
            Manage your personal information and contact preferences
          </Text>
        </View>

        {/* Account Fields */}
        <View style={styles.fieldsSection}>
          <TouchableOpacity style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>E-mail Address</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>fabian.wirtz@gmail.com</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Change password</Text>
            <View style={styles.fieldRow}>
              <View />
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Login with Google/Apple Section */}
        <Text style={styles.sectionTitle}>Login with Google/Apple</Text>

        <View>
          <TouchableOpacity style={styles.socialItem}>
            <View style={styles.socialIconPlaceholder} />
            <Text style={styles.socialText}>fabian.wirtz@gmail.com</Text>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
