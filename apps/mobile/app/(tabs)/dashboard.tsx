import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// Mock data for now until backend is ready
const mockInventory = [
  { id: '1', brand: 'Rolex', model: 'Submariner Date', price: 12500, condition: 'Excellent' },
  { id: '2', brand: 'Omega', model: 'Speedmaster Professional', price: 6800, condition: 'New' },
  { id: '3', brand: 'Patek Philippe', model: 'Calatrava', price: 28000, condition: 'Excellent' },
];

const mockStats = {
  total_watches: 3,
  total_value: 47300,
};

export default function DashboardScreen() {
  const { colors } = useTheme();
  const [inventory] = useState<any[]>(mockInventory);
  const [stats] = useState<any>(mockStats);
  const loading = false;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
      padding: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 4,
    },
    emptyState: {
      padding: 32,
      alignItems: 'center',
    },
    list: {
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    watchTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    price: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 8,
    },
    details: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>My Inventory</Text>

        {loading ? (
          <Text style={styles.subtitle}>Loading...</Text>
        ) : (
          <>
            {stats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Watches</Text>
                  <Text style={styles.statValue}>{stats.total_watches}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Value</Text>
                  <Text style={styles.statValue}>${stats.total_value.toLocaleString()}</Text>
                </View>
              </View>
            )}

            {inventory.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.subtitle}>Your inventory is empty</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {inventory.map((watch) => (
                  <View key={watch.id} style={styles.card}>
                    <Text style={styles.watchTitle}>{watch.brand} {watch.model}</Text>
                    <Text style={styles.price}>${watch.price.toLocaleString()}</Text>
                    <Text style={styles.details}>Condition: {watch.condition}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
