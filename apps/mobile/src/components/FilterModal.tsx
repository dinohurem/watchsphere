import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from './icons';
import { LocationFilter, Location } from './LocationFilter';
import { YearMonthFilter, YearMonthSelection } from './YearMonthFilter';
import { WareConditionFilter, WareCondition } from './WareConditionFilter';

export interface MarketFilters {
  locations: Location[];
  brands: string[];
  years: YearMonthSelection[];
  conditions: WareCondition[];
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: MarketFilters;
  onApplyFilters: (filters: MarketFilters) => void;
}

const AVAILABLE_BRANDS = [
  'Rolex',
  'Omega',
  'Patek Philippe',
  'Audemars Piguet',
  'Cartier',
  'TAG Heuer',
  'IWC',
  'Breitling',
];

export function FilterModal({ visible, onClose, filters, onApplyFilters }: FilterModalProps) {
  const [tempFilters, setTempFilters] = React.useState<MarketFilters>(filters);

  React.useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  const handleToggleLocation = (location: Location) => {
    setTempFilters((prev) => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter((l) => l !== location)
        : [...prev.locations, location],
    }));
  };

  const handleToggleBrand = (brand: string) => {
    setTempFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  };

  const handleToggleYear = (period: YearMonthSelection) => {
    setTempFilters((prev) => {
      const exists = prev.years.some(
        (p) => p.year === period.year && p.month === period.month
      );
      return {
        ...prev,
        years: exists
          ? prev.years.filter(
              (p) => !(p.year === period.year && p.month === period.month)
            )
          : [...prev.years, period],
      };
    });
  };

  const handleToggleCondition = (condition: WareCondition) => {
    setTempFilters((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition],
    }));
  };

  const handleApply = () => {
    onApplyFilters(tempFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: MarketFilters = {
      locations: [],
      brands: [],
      years: [],
      conditions: [],
    };
    setTempFilters(resetFilters);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Filter Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Location Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <LocationFilter
              selectedLocations={tempFilters.locations}
              onToggleLocation={handleToggleLocation}
            />
          </View>

          {/* Brand Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand</Text>
            <View style={styles.brandGrid}>
              {AVAILABLE_BRANDS.map((brand) => {
                const isSelected = tempFilters.brands.includes(brand);
                return (
                  <TouchableOpacity
                    key={brand}
                    style={[styles.brandButton, isSelected && styles.brandButtonActive]}
                    onPress={() => handleToggleBrand(brand)}
                  >
                    <Text style={[styles.brandText, isSelected && styles.brandTextActive]}>
                      {brand}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Year & Month Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Year & Month</Text>
            <YearMonthFilter
              selectedPeriods={tempFilters.years}
              onTogglePeriod={handleToggleYear}
            />
          </View>

          {/* Condition Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condition</Text>
            <WareConditionFilter
              selectedConditions={tempFilters.conditions}
              onToggleCondition={handleToggleCondition}
            />
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Add React import
import React from 'react';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  brandButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  brandTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
