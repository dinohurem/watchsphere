import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFilters } from '@/contexts/FilterContext';
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

interface BrandItemProps {
  name: string;
  selected: boolean;
  onPress: () => void;
}

function BrandItem({ name, selected, onPress }: BrandItemProps) {
  return (
    <TouchableOpacity style={styles.brandItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.brandText, selected && styles.brandTextSelected]}>{name}</Text>
      {selected ? <CheckboxChecked /> : <CheckboxEmpty />}
    </TouchableOpacity>
  );
}

const BRANDS = [
  'Patek Philippe',
  'Audemars Piguet',
  'Vacheron Constantin',
  'A. Lange & Söhne',
  'Breguet',
  'Rolex',
  'Omega',
  'Jaeger-LeCoultre',
  'Blancpain',
  'Girard-Perregaux',
  'Richard Mille',
  'Hublot',
  'IWC Schaffhausen',
  'Panerai',
  'Cartier',
  'TAG Heuer',
  'Breitling',
  'Tudor',
  'Zenith',
  'Chopard',
  'Piaget',
  'Ulysse Nardin',
  'Grand Seiko',
  'Montblanc',
  'Nomos Glashütte',
  'Glashutte Original',
  'Bell & Ross',
  'Oris',
  'Longines',
  'Tissot',
];

export default function BrandFilterScreen() {
  const { filters, toggleFilterItem, resetFilterCategory } = useFilters();
  const [searchQuery, setSearchQuery] = useState('');
  const selectedBrands = filters.brands;

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return BRANDS;
    const query = searchQuery.toLowerCase();
    return BRANDS.filter(brand => brand.toLowerCase().includes(query));
  }, [searchQuery]);

  const toggleBrand = (brand: string) => {
    toggleFilterItem('brands', brand);
  };

  const handleReset = () => {
    resetFilterCategory('brands');
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
        <Text style={styles.headerTitle}>Brand</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search brands"
            placeholderTextColor="rgba(33, 33, 33, 0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Brands List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredBrands.map(brand => (
          <BrandItem
            key={brand}
            name={brand}
            selected={selectedBrands.includes(brand)}
            onPress={() => toggleBrand(brand)}
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
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  brandText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 15,
    color: '#212121',
    letterSpacing: 0.075,
  },
  brandTextSelected: {
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
