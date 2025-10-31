import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SearchBar } from '@/components/SearchBar';
import { WatchListItem } from '@/components/WatchListItem';
import { FilterModal, MarketFilters } from '@/components/FilterModal';
import { ActiveFilters } from '@/components/ActiveFilters';
import { Filter } from '@/components/icons';
import { Location } from '@/components/LocationFilter';
import { WareCondition } from '@/components/WareConditionFilter';
import { YearMonthSelection } from '@/components/YearMonthFilter';

// Mock data with price history for charts
const mockWatches = [
  {
    id: '1',
    brand: 'Rolex',
    model: 'Explorer',
    reference: '224270',
    price: 8149,
    priceChange: 3.9,
    priceHistory: [7800, 7900, 8000, 7950, 8100, 8149]
  },
  {
    id: '2',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    price: 12352,
    priceChange: -0.7,
    priceHistory: [12500, 12450, 12400, 12380, 12370, 12352]
  },
  {
    id: '3',
    brand: 'Cartier',
    model: 'Santos',
    reference: 'WSSA0018',
    price: 7244,
    priceChange: 5.9,
    priceHistory: [6800, 6900, 7000, 7100, 7200, 7244]
  },
  {
    id: '4',
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '5712/1A',
    price: 97467,
    priceChange: 1.2,
    priceHistory: [96000, 96500, 97000, 96800, 97200, 97467]
  },
  {
    id: '5',
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    reference: '15510ST.OO.1320ST.01',
    price: 57594,
    priceChange: 6.2,
    priceHistory: [54000, 54500, 55500, 56200, 57000, 57594]
  },
];

export default function MarketScreen() {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<MarketFilters>({
    locations: [],
    brands: [],
    years: [],
    conditions: [],
  });

  const handleWatchPress = (watchId: string) => {
    router.push(`/watch/${watchId}`);
  };

  const handleApplyFilters = (newFilters: MarketFilters) => {
    setFilters(newFilters);
    // Here you would typically fetch new data based on filters
  };

  const handleRemoveFilter = (
    type: 'location' | 'brand' | 'year' | 'condition',
    value: Location | string | YearMonthSelection | WareCondition
  ) => {
    setFilters((prev) => {
      switch (type) {
        case 'location':
          return {
            ...prev,
            locations: prev.locations.filter((l) => l !== value),
          };
        case 'brand':
          return {
            ...prev,
            brands: prev.brands.filter((b) => b !== value),
          };
        case 'year':
          return {
            ...prev,
            years: prev.years.filter(
              (y) =>
                !(
                  y.year === (value as YearMonthSelection).year &&
                  y.month === (value as YearMonthSelection).month
                )
            ),
          };
        case 'condition':
          return {
            ...prev,
            conditions: prev.conditions.filter((c) => c !== value),
          };
        default:
          return prev;
      }
    });
  };

  const handleClearAllFilters = () => {
    setFilters({
      locations: [],
      brands: [],
      years: [],
      conditions: [],
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    filterIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.buttonBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scrollView: {
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search watches..."
        />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterIconButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Filter size={20} color={colors.text} />
        </TouchableOpacity>
        <ActiveFilters
          filters={filters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
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
            priceHistory={watch.priceHistory}
            onPress={() => handleWatchPress(watch.id)}
          />
        ))}
      </ScrollView>

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
      />
    </SafeAreaView>
  );
}
