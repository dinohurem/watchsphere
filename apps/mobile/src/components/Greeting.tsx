import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useTheme } from '@/contexts/ThemeContext';
import { Bell } from './icons';

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
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    greetingText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    notificationButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.buttonBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.greetingText}>
        {greeting} {firstName}.
      </Text>
      <TouchableOpacity style={styles.notificationButton}>
        <Bell size={20} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}
