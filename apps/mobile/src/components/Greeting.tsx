import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useTheme } from '@/contexts/ThemeContext';
import { Bell } from './icons';
import { Logo } from './Logo';

export function Greeting() {
  const user = useAuthStore((state) => state.user);
  const { colors } = useTheme();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Extract first name from full name
  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  const styles = StyleSheet.create({
    wrapper: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    logoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    logo: {
      width: 207.78,
      height: 44,
    },
    notificationButton: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    greetingText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
  });

  return (
    <View style={styles.wrapper}>
      {/* Logo and Notification */}
      <View style={styles.logoContainer}>
        <Logo width={207.78} height={44} />
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/notifications' as any)}
        >
          <Bell size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingText}>
          {greeting} {firstName}.
        </Text>
      </View>
    </View>
  );
}
