import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
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

export function FilterModal({ visible, onClose, filters, onApplyFilters }: FilterModalProps) {
  const { colors, fonts } = useTheme();
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
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
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 12,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resetButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    applyButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
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
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
