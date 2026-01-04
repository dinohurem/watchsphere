import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect, G, ClipPath, Defs } from 'react-native-svg';
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

// Country flag component (simplified circles with colors)
interface FlagProps {
  country: string;
}

function Flag({ country }: FlagProps) {
  // Use country-specific flag colors
  const flagColors: Record<string, string[]> = {
    'Albania': ['#E41E20', '#000000'],
    'Argentina': ['#74ACDF', '#FFFFFF', '#F6B40E'],
    'Austria': ['#ED2939', '#FFFFFF'],
    'Belgium': ['#000000', '#FDDA24', '#EF3340'],
    'Belarus': ['#D22730', '#00AF66'],
    'Brazil': ['#009739', '#FFDF00'],
    'China': ['#DE2910', '#FFDE00'],
    'Czech Republic': ['#D7141A', '#11457E', '#FFFFFF'],
    'Denmark': ['#C8102E', '#FFFFFF'],
    'Germany': ['#000000', '#DD0000', '#FFCC00'],
    'Ireland': ['#009A49', '#FFFFFF', '#FF7900'],
    'Italy': ['#009246', '#FFFFFF', '#CE2B37'],
    'Luxembourg': ['#EF3340', '#FFFFFF', '#00A3E0'],
    'Liechtenstein': ['#002B7F', '#CE1126'],
    'Switzerland': ['#FF0000', '#FFFFFF'],
    'France': ['#0055A4', '#FFFFFF', '#EF4135'],
    'Spain': ['#AA151B', '#F1BF00'],
    'United Kingdom': ['#012169', '#C8102E', '#FFFFFF'],
    'United States': ['#3C3B6E', '#B22234', '#FFFFFF'],
    'Japan': ['#FFFFFF', '#BC002D'],
    'Singapore': ['#ED2939', '#FFFFFF'],
    'Hong Kong': ['#DE2910', '#FFFFFF'],
    'United Arab Emirates': ['#00732F', '#FFFFFF', '#FF0000', '#000000'],
    'Netherlands': ['#AE1C28', '#FFFFFF', '#21468B'],
    'Portugal': ['#006600', '#FF0000'],
    'Poland': ['#FFFFFF', '#DC143C'],
    'Monaco': ['#CE1126', '#FFFFFF'],
  };

  const colors = flagColors[country] || ['#CCCCCC', '#999999'];

  return (
    <View style={styles.flagContainer}>
      <Svg width={15} height={15} viewBox="0 0 15 15">
        <Defs>
          <ClipPath id="circleClip">
            <Circle cx={7.5} cy={7.5} r={7.5} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#circleClip)">
          {colors.length === 2 ? (
            <>
              <Rect x={0} y={0} width={7.5} height={15} fill={colors[0]} />
              <Rect x={7.5} y={0} width={7.5} height={15} fill={colors[1]} />
            </>
          ) : colors.length >= 3 ? (
            <>
              <Rect x={0} y={0} width={5} height={15} fill={colors[0]} />
              <Rect x={5} y={0} width={5} height={15} fill={colors[1]} />
              <Rect x={10} y={0} width={5} height={15} fill={colors[2]} />
            </>
          ) : (
            <Rect x={0} y={0} width={15} height={15} fill={colors[0]} />
          )}
        </G>
        <Circle cx={7.5} cy={7.5} r={7} stroke="rgba(0,0,0,0.1)" strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
}

interface LocationItemProps {
  country: string;
  selected: boolean;
  onPress: () => void;
}

function LocationItem({ country, selected, onPress }: LocationItemProps) {
  return (
    <TouchableOpacity style={styles.locationItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.locationLeft}>
        <Flag country={country} />
        <Text style={[styles.locationText, selected && styles.locationTextSelected]}>{country}</Text>
      </View>
      {selected ? <CheckboxChecked /> : <CheckboxEmpty />}
    </TouchableOpacity>
  );
}

const COUNTRIES = [
  'Albania',
  'Argentina',
  'Austria',
  'Belgium',
  'Belarus',
  'Brazil',
  'China',
  'Czech Republic',
  'Denmark',
  'France',
  'Germany',
  'Hong Kong',
  'Ireland',
  'Italy',
  'Japan',
  'Liechtenstein',
  'Luxembourg',
  'Monaco',
  'Netherlands',
  'Poland',
  'Portugal',
  'Singapore',
  'Spain',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
];

export default function LocationFilterScreen() {
  const { filters, toggleFilterItem, resetFilterCategory } = useFilters();
  const selectedLocations = filters.locations;

  const toggleLocation = (location: string) => {
    toggleFilterItem('locations', location);
  };

  const handleReset = () => {
    resetFilterCategory('locations');
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
        <Text style={styles.headerTitle}>Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Locations List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {COUNTRIES.map(country => (
          <LocationItem
            key={country}
            country={country}
            selected={selectedLocations.includes(country)}
            onPress={() => toggleLocation(country)}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flagContainer: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    overflow: 'hidden',
  },
  locationText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 15,
    color: '#212121',
    letterSpacing: 0.075,
    marginLeft: 4,
  },
  locationTextSelected: {
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
