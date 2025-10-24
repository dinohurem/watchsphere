import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useAuthStore } from '@watchsphere/shared/stores';

export function Greeting() {
  const user = useAuthStore((state) => state.user);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.greetingText}>
        {greeting}, {user?.name || 'User'}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
