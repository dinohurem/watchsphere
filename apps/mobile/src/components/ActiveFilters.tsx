import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { X } from './icons';
import { MarketFilters } from './FilterModal';
import { Location } from './LocationFilter';

interface ActiveFiltersProps {
  filters: MarketFilters;
  onRemoveFilter: (type: 'location' | 'brand' | 'year' | 'condition', value: any) => void;
  onClearAll: () => void;
}

const locationLabels: Record<Location, string> = {
  US: 'US',
  EU: 'EU',
  UAE: 'UAE',
  HK: 'HK',
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ActiveFilters({ filters, onRemoveFilter, onClearAll }: ActiveFiltersProps) {
  const { colors, fonts } = useTheme();
  const hasFilters =
    filters.locations.length > 0 ||
    filters.brands.length > 0 ||
    filters.years.length > 0 ||
    filters.conditions.length > 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingLeft: 12,
      paddingRight: 8,
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    filterText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    clearAllButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearAllText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.textTertiary,
    },
  });

  if (!hasFilters) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
        {/* Location filters */}
        {filters.locations.map((location) => (
          <TouchableOpacity
            key={`location-${location}`}
            style={styles.filterChip}
            onPress={() => onRemoveFilter('location', location)}
          >
            <Text style={styles.filterText}>{locationLabels[location]}</Text>
            <X size={14} color={colors.primary} />
          </TouchableOpacity>
        ))}

        {/* Brand filters */}
        {filters.brands.map((brand) => (
          <TouchableOpacity
            key={`brand-${brand}`}
            style={styles.filterChip}
            onPress={() => onRemoveFilter('brand', brand)}
          >
            <Text style={styles.filterText}>{brand}</Text>
            <X size={14} color={colors.primary} />
          </TouchableOpacity>
        ))}

        {/* Year filters */}
        {filters.years.map((year, index) => (
          <TouchableOpacity
            key={`year-${year.year}-${year.month || 'all'}-${index}`}
            style={styles.filterChip}
            onPress={() => onRemoveFilter('year', year)}
          >
            <Text style={styles.filterText}>
              {year.month ? monthNames[parseInt(year.month) - 1] : year.year}
            </Text>
            <X size={14} color={colors.primary} />
          </TouchableOpacity>
        ))}

        {/* Condition filters */}
        {filters.conditions.map((condition) => (
          <TouchableOpacity
            key={`condition-${condition}`}
            style={styles.filterChip}
            onPress={() => onRemoveFilter('condition', condition)}
          >
            <Text style={styles.filterText}>
              {condition === 'unworn' ? 'Unworn' : 'Worn'}
            </Text>
            <X size={14} color={colors.primary} />
          </TouchableOpacity>
        ))}

        {/* Clear all button */}
        <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
    </ScrollView>
  );
}
