import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFilters, FilterState } from '@/contexts/FilterContext';
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
  model: 'models',
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

// Filter type configurations
const FILTER_CONFIG: Record<string, { title: string; items: string[]; searchable?: boolean }> = {
  model: {
    title: 'Model',
    searchable: true,
    items: [
      'Nautilus',
      'Royal Oak',
      'Overseas',
      'Datograph',
      'Tradition',
      'Submariner',
      'Speedmaster',
      'Reverso',
      'Fifty Fathoms',
      '1966',
      'RM 011',
      'Big Bang',
      'Portugieser',
      'Luminor',
    ],
  },
  price: {
    title: 'Price',
    items: [
      'Under $1,000',
      '$1,000 - $5,000',
      '$5,000 - $10,000',
      '$10,000 - $25,000',
      '$25,000 - $50,000',
      '$50,000 - $100,000',
      '$100,000 - $250,000',
      '$250,000 - $500,000',
      'Over $500,000',
    ],
  },
  reference: {
    title: 'Reference Number',
    searchable: true,
    items: [
      '5711/1A',
      '15202ST',
      '4500V',
      '403.035',
      '7097BB',
      '126610LN',
      '310.30.42.50.01.002',
      'Q3858520',
      '5000-1110-B52A',
      '49555-11-131-BB6A',
    ],
  },
  delivery: {
    title: 'Delivery Contents',
    items: [
      'Watch only',
      'Watch with original box',
      'Watch with original papers',
      'Full set (box and papers)',
      'Full set with original receipt',
    ],
  },
  availability: {
    title: 'Availability',
    items: [
      'In stock',
      'Available on request',
      'Coming soon',
      'Pre-order',
    ],
  },
  'condition-type': {
    title: 'New/Used',
    items: [
      'New',
      'Unworn',
      'Pre-owned',
    ],
  },
  condition: {
    title: 'Condition',
    items: [
      'Mint',
      'Excellent',
      'Very Good',
      'Good',
      'Fair',
    ],
  },
  'case-diameter': {
    title: 'Case diameter/width',
    items: [
      'Under 36mm',
      '36mm - 38mm',
      '38mm - 40mm',
      '40mm - 42mm',
      '42mm - 44mm',
      '44mm - 46mm',
      'Over 46mm',
    ],
  },
  'lug-width': {
    title: 'Lug width',
    items: [
      '18mm',
      '19mm',
      '20mm',
      '21mm',
      '22mm',
      '24mm',
    ],
  },
  'case-thickness': {
    title: 'Case thickness',
    items: [
      'Under 8mm',
      '8mm - 10mm',
      '10mm - 12mm',
      '12mm - 14mm',
      'Over 14mm',
    ],
  },
  gender: {
    title: 'Gender',
    items: [
      "Men's watch",
      "Women's watch",
      'Unisex',
    ],
  },
  'watch-type': {
    title: 'Watch type',
    items: [
      'Wristwatch',
      'Pocket watch',
    ],
  },
  'watch-style': {
    title: 'Style of watch',
    items: [
      'Dress watch',
      'Sports watch',
      'Diving watch',
      'Pilot watch',
      'Field watch',
      'Chronograph',
      'GMT/World time',
    ],
  },
  movement: {
    title: 'Movement',
    items: [
      'Automatic',
      'Manual winding',
      'Quartz',
      'Solar',
      'Kinetic',
    ],
  },
  functions: {
    title: 'Functions',
    items: [
      'Date',
      'Day-Date',
      'Chronograph',
      'GMT/Second time zone',
      'Power reserve indicator',
      'Moon phase',
      'Annual calendar',
      'Perpetual calendar',
      'Minute repeater',
      'Tourbillon',
    ],
  },
  'dial-style': {
    title: 'Dial style',
    items: [
      'Arabic numerals',
      'Roman numerals',
      'Index',
      'Mixed',
      'No numerals',
    ],
  },
  'dial-color': {
    title: 'Dial color',
    items: [
      'Black',
      'White',
      'Silver',
      'Blue',
      'Green',
      'Brown',
      'Champagne/Gold',
      'Grey',
      'Mother of pearl',
    ],
  },
  'case-material': {
    title: 'Case material',
    items: [
      'Stainless steel',
      'Yellow gold',
      'Rose gold',
      'White gold',
      'Platinum',
      'Titanium',
      'Ceramic',
      'Carbon',
      'Bronze',
    ],
  },
  'bezel-material': {
    title: 'Bezel material',
    items: [
      'Stainless steel',
      'Yellow gold',
      'Rose gold',
      'White gold',
      'Platinum',
      'Ceramic',
      'Diamonds',
    ],
  },
  'crystal-type': {
    title: 'Crystal type',
    items: [
      'Sapphire crystal',
      'Mineral glass',
      'Hesalite/Plexiglass',
    ],
  },
  'water-resistance': {
    title: 'Water resistance',
    items: [
      'Not water resistant',
      '30m / 3 ATM',
      '50m / 5 ATM',
      '100m / 10 ATM',
      '200m / 20 ATM',
      '300m / 30 ATM',
      '500m+',
    ],
  },
  'band-material': {
    title: 'Band material',
    items: [
      'Leather',
      'Stainless steel',
      'Yellow gold',
      'Rose gold',
      'White gold',
      'Platinum',
      'Titanium',
      'Rubber',
      'NATO/Fabric',
    ],
  },
  'band-color': {
    title: 'Band color',
    items: [
      'Black',
      'Brown',
      'Blue',
      'Green',
      'Silver',
      'Gold',
      'Rose gold',
      'White',
    ],
  },
  'clasp-material': {
    title: 'Clasp material',
    items: [
      'Stainless steel',
      'Yellow gold',
      'Rose gold',
      'White gold',
      'Platinum',
      'Titanium',
    ],
  },
  'clasp-type': {
    title: 'Clasp type',
    items: [
      'Fold clasp',
      'Deployant clasp',
      'Butterfly clasp',
      'Pin buckle',
      'Hidden clasp',
    ],
  },
};

export default function GenericFilterScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const config = FILTER_CONFIG[type || ''] || { title: 'Filter', items: [] };
  const filterKey = TYPE_TO_FILTER_KEY[type || ''];

  const { filters, toggleFilterItem, resetFilterCategory } = useFilters();
  const [searchQuery, setSearchQuery] = useState('');

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
