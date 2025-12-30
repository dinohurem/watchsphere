import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useContext } from 'react';
import { AIButtonContext } from '@/contexts/AIButtonContext';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { ArrowLeft, ChevronRight, User, Clock, Star, Bell, Languages, FileText, Lock, Database } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';

export default function SettingsScreen() {
  const { colors, fonts } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const { showAIButton, setShowAIButton } = useContext(AIButtonContext);
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const getThemeLabel = (themeValue: Theme) => {
    switch (themeValue) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
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
    card: {
      backgroundColor: colors.card,
      marginHorizontal: wp(16),
      marginBottom: hp(16),
      borderRadius: sp(12),
      padding: wp(16),
    },
    cardTitle: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: hp(12),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    menuIconContainer: {
      width: sp(32),
      height: sp(32),
      borderRadius: sp(8),
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: wp(12),
    },
    menuText: {
      flex: 1,
      fontSize: fp(15),
      color: colors.text,
    },
    menuTextContainer: {
      flex: 1,
    },
    themeButtons: {
      flexDirection: 'row',
      gap: wp(8),
      marginTop: hp(8),
    },
    themeButton: {
      paddingVertical: hp(6),
      paddingHorizontal: wp(12),
      borderRadius: sp(8),
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeButtonText: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: colors.text,
    },
    themeButtonTextActive: {
      color: '#FFFFFF',
    },
    logoutButton: {
      backgroundColor: colors.error,
      padding: wp(16),
      borderRadius: sp(12),
      alignItems: 'center',
      marginHorizontal: wp(16),
      marginTop: hp(8),
      marginBottom: hp(32),
    },
    logoutText: {
      color: '#FFFFFF',
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/profile-settings' as any)}
          >
            <View style={styles.menuIconContainer}>
              <User size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Profile</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Clock size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>History</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Star size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Reviews</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/account-details' as any)}
          >
            <View style={styles.menuIconContainer}>
              <Lock size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Account Details</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/notifications' as any)}
          >
            <View style={styles.menuIconContainer}>
              <Bell size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <FileText size={20} color={colors.text} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Theme</Text>
              <View style={styles.themeButtons}>
                {(['light', 'dark', 'system'] as Theme[]).map((themeOption) => (
                  <TouchableOpacity
                    key={themeOption}
                    style={[
                      styles.themeButton,
                      theme === themeOption && styles.themeButtonActive,
                    ]}
                    onPress={() => setTheme(themeOption)}
                  >
                    <Text
                      style={[
                        styles.themeButtonText,
                        theme === themeOption && styles.themeButtonTextActive,
                      ]}
                    >
                      {getThemeLabel(themeOption)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Languages size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Language</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <FileText size={20} color={colors.text} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Show AI Assistant</Text>
            </View>
            <Switch
              value={showAIButton}
              onValueChange={setShowAIButton}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Database size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>General</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <FileText size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Privacy Policy</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Lock size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Terms and Conditions</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Database size={20} color={colors.text} />
            </View>
            <Text style={styles.menuText}>Data</Text>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
