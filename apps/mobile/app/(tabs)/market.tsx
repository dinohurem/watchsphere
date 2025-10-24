import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export default function MarketScreen() {
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatches();
  }, []);

  const loadWatches = async () => {
    try {
      const response = await api.get('/market');
      setWatches(response.data);
    } catch (error) {
      console.error('Failed to load watches:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Market</Text>

        {loading ? (
          <Text style={styles.subtitle}>Loading...</Text>
        ) : watches.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.subtitle}>No watches listed yet</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {watches.map((watch) => (
              <TouchableOpacity key={watch.id} style={styles.card}>
                <Text style={styles.watchTitle}>{watch.brand} {watch.model}</Text>
                <Text style={styles.price}>${watch.price.toLocaleString()}</Text>
                <Text style={styles.details}>Condition: {watch.condition}</Text>
                {watch.year && <Text style={styles.details}>Year: {watch.year}</Text>}
              </TouchableOpacity>
            ))}
          </View>
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
    fontSize: 24,
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
