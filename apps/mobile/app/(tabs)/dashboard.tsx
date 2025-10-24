import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export default function DashboardScreen() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [inventoryRes, statsRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/stats'),
      ]);
      setInventory(inventoryRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
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
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  watchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
  },
  details: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
