import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useContext } from 'react';
import { AIButtonContext } from './_layout';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { User, Clock, Star, Bell, Languages, FileText, Lock, Database, ChevronRight } from '@/components/icons';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { showAIButton, setShowAIButton } = useContext(AIButtonContext);
  const { theme, setTheme, colors } = useTheme();

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
      backgroundColor: colors.backgroundSecondary,
    },
    scrollView: {
      flex: 1,
      padding: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 24,
    },
    profileImageContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    profileImage: {
      width: 80,
      height: 80,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    userName: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    menuIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    menuText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    menuTextContainer: {
      flex: 1,
    },
    themeButtons: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    themeButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    themeButtonTextActive: {
      color: '#FFFFFF',
    },
    logoutButton: {
      backgroundColor: colors.error,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    logoutText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Profile</Text>

        {/* Profile Image */}
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImage}>
            <User size={48} color={colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Account Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem}>
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
        </View>

        {/* Settings Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>

          <TouchableOpacity style={styles.menuItem}>
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
