import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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

interface YearItemProps {
  year: number;
  selected: boolean;
  onPress: () => void;
}

function YearItem({ year, selected, onPress }: YearItemProps) {
  return (
    <TouchableOpacity style={styles.yearItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.yearText, selected && styles.yearTextSelected]}>{year}</Text>
      {selected ? <CheckboxChecked /> : <CheckboxEmpty />}
    </TouchableOpacity>
  );
}

export default function YearFilterScreen() {
  const { filters, toggleFilterItem, resetFilterCategory } = useFilters();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);
  const selectedYears = filters.years.map(y => parseInt(y, 10));

  const toggleYear = (year: number) => {
    toggleFilterItem('years', year.toString());
  };

  const handleReset = () => {
    resetFilterCategory('years');
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
        <Text style={styles.headerTitle}>Year of production</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Years List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {years.map(year => (
          <YearItem
            key={year}
            year={year}
            selected={selectedYears.includes(year)}
            onPress={() => toggleYear(year)}
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
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  yearText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 15,
    color: '#212121',
    letterSpacing: 0.075,
  },
  yearTextSelected: {
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
