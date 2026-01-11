import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFilters, FilterState } from '@/contexts/FilterContext';
import { useConfig } from '@/contexts/ConfigContext';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Back Arrow Icon
function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Search Icon
function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M8.25 14.25C11.5637 14.25 14.25 11.5637 14.25 8.25C14.25 4.93629 11.5637 2.25 8.25 2.25C4.93629 2.25 2.25 4.93629 2.25 8.25C2.25 11.5637 4.93629 14.25 8.25 14.25Z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />
      <Path
        d="M15.75 15.75L12.4875 12.4875"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />
    </Svg>
  );
}

// Checkbox unchecked
function CheckboxEmpty() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={9} stroke="#EBEBEB" strokeWidth={2} />
    </Svg>
  );
}

// Checkbox checked
function CheckboxChecked() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={10} fill="#212121" />
      <Path
        d="M6 10L9 13L14 7"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface FilterItemProps {
  name: string;
  selected: boolean;
  onPress: () => void;
}

function FilterItemRow({ name, selected, onPress }: FilterItemProps) {
  return (
    <TouchableOpacity style={styles.filterItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{name}</Text>
      {selected ? <CheckboxChecked /> : <CheckboxEmpty />}
    </TouchableOpacity>
  );
}

// Map URL type to FilterState key
const TYPE_TO_FILTER_KEY: Record<string, keyof FilterState> = {
  brand: 'brands',
  model: 'models',
  year: 'years',
  location: 'locations',
  price: 'priceMin',
  reference: 'references',
  delivery: 'deliveryContents',
  availability: 'availability',
  'condition-type': 'conditionType',
  condition: 'condition',
  'case-diameter': 'caseDiameter',
  'lug-width': 'lugWidth',
  'case-thickness': 'caseThickness',
  gender: 'gender',
  'watch-type': 'watchType',
  'watch-style': 'watchStyle',
  movement: 'movement',
  functions: 'functions',
  'dial-style': 'dialStyle',
  'dial-color': 'dialColor',
  'case-material': 'caseMaterial',
  'bezel-material': 'bezelMaterial',
  'crystal-type': 'crystalType',
  'water-resistance': 'waterResistance',
  'band-material': 'bandMaterial',
  'band-color': 'bandColor',
  'clasp-material': 'claspMaterial',
  'clasp-type': 'claspType',
};

// Map URL type to filter key in the backend
const TYPE_TO_BACKEND_KEY: Record<string, string> = {
  brand: 'brand',
  model: 'model',
  year: 'year',
  location: 'location',
  price: 'price',
  reference: 'reference',
  delivery: 'delivery',
  availability: 'availability',
  'condition-type': 'condition_type',
  condition: 'condition',
  'case-diameter': 'case_diameter',
  'lug-width': 'lug_width',
  'case-thickness': 'case_thickness',
  gender: 'gender',
  'watch-type': 'watch_type',
  'watch-style': 'watch_style',
  movement: 'movement',
  functions: 'functions',
  'dial-style': 'dial_style',
  'dial-color': 'dial_color',
  'case-material': 'case_material',
  'bezel-material': 'bezel_material',
  'crystal-type': 'crystal_type',
  'water-resistance': 'water_resistance',
  'band-material': 'band_material',
  'band-color': 'band_color',
  'clasp-material': 'clasp_material',
  'clasp-type': 'clasp_type',
};

export default function GenericFilterScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const filterKey = TYPE_TO_FILTER_KEY[type || ''];
  const backendKey = TYPE_TO_BACKEND_KEY[type || ''];

  const { filters, toggleFilterItem, resetFilterCategory } = useFilters();
  const { getFilterByKey, getFilterOptions, loadMarketFilters, isLoadingMarketFilters } = useConfig();
  const [searchQuery, setSearchQuery] = useState('');

  // Lazy load market filters when component mounts
  useEffect(() => {
    loadMarketFilters();
  }, [loadMarketFilters]);

  // Get filter config from backend
  const filterConfig = backendKey ? getFilterByKey('market', backendKey) : undefined;

  // Build config object from dynamic data
  const config = useMemo(() => {
    if (!filterConfig) {
      return { title: 'Filter', items: [], searchable: false };
    }
    return {
      title: filterConfig.name,
      items: filterConfig.values
        .filter(v => v.is_enabled)
        .sort((a, b) => a.display_order - b.display_order)
        .map(v => v.label),
      searchable: filterConfig.is_searchable,
    };
  }, [filterConfig]);

  // Get selected items from context (handle both string[] arrays)
  const selectedItems = filterKey && Array.isArray(filters[filterKey])
    ? (filters[filterKey] as string[])
    : [];

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim() || !config.searchable) return config.items;
    const query = searchQuery.toLowerCase();
    return config.items.filter(item => item.toLowerCase().includes(query));
  }, [searchQuery, config.items, config.searchable]);

  const toggleItem = (item: string) => {
    if (filterKey) {
      toggleFilterItem(filterKey, item);
    }
  };

  const handleReset = () => {
    if (filterKey) {
      resetFilterCategory(filterKey);
    }
    setSearchQuery('');
  };

  const handleApply = () => {
    // Filter already persisted via context, just go back
    router.back();
  };

  // Show loading state while market filters are loading
  if (isLoadingMarketFilters) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filter</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar (if searchable) */}
      {config.searchable && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <SearchIcon />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${config.title.toLowerCase()}`}
              placeholderTextColor="rgba(33, 33, 33, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      )}

      {/* Items List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredItems.map(item => (
          <FilterItemRow
            key={item}
            name={item}
            selected={selectedItems.includes(item)}
            onPress={() => toggleItem(item)}
          />
        ))}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.43,
  },
  headerSpacer: {
    width: 44,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 15,
    color: '#212121',
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  filterText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 15,
    color: '#212121',
    letterSpacing: 0.075,
  },
  filterTextSelected: {
    fontWeight: '600',
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  resetButton: {
    flex: 1,
    height: 44,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#212121',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    letterSpacing: 0.075,
  },
  applyButton: {
    flex: 1,
    height: 44,
    borderRadius: 99,
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.075,
  },
});
