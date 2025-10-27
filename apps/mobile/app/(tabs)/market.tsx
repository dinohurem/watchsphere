import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { SearchBar } from '@/components/SearchBar';
import { FilterPills } from '@/components/FilterPills';
import { WatchListItem } from '@/components/WatchListItem';

// Mock data matching the design
const mockWatches = [
  { id: '1', brand: 'Rolex', model: 'Explorer', reference: '224270', price: 8149, priceChange: 3.9 },
  { id: '2', brand: 'Rolex', model: 'Submariner Date', reference: '126610LN', price: 12352, priceChange: -0.7 },
  { id: '3', brand: 'Cartier', model: 'Santos', reference: 'WSSA0018', price: 7244, priceChange: 5.9 },
  { id: '4', brand: 'Patek Philippe', model: 'Nautilus', reference: '5712/1A', price: 97467, priceChange: 1.2 },
  { id: '5', brand: 'Audemars Piguet', model: 'Royal Oak', reference: '15510ST.OO.1320ST.01', price: 57594, priceChange: 6.2 },
];

export default function MarketScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'Rolex', 'Omega', 'Audemars Piguet', 'Patek Philippe'];

  const handleWatchPress = (watchId: string) => {
    router.push(`/watch/${watchId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search watches..."
        />
      </View>

      <View style={styles.filterSection}>
        <FilterPills
          filters={filters}
          activeFilter={activeFilter}
          onFilterPress={setActiveFilter}
          onFilterIconPress={() => console.log('Open filter modal')}
        />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {mockWatches.map((watch) => (
          <WatchListItem
            key={watch.id}
            brand={watch.brand}
            model={watch.model}
            referenceNumber={watch.reference}
            price={watch.price}
            priceChange={watch.priceChange}
            onPress={() => handleWatchPress(watch.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  filterSection: {
    marginBottom: 4,
  },
  scrollView: {
    flex: 1,
  },
});
