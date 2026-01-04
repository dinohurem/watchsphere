import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
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

// Chevron Right Icon
function ChevronRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M6.75 13.5L11.25 9L6.75 4.5"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Count Badge Component
function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{count}</Text>
    </View>
  );
}

interface FilterItemProps {
  label: string;
  filterKey: keyof FilterState;
  onPress: () => void;
}

function FilterItem({ label, filterKey, onPress }: FilterItemProps) {
  const { getFilterCount } = useFilters();
  const count = getFilterCount(filterKey);

  return (
    <TouchableOpacity style={styles.filterItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.filterItemText}>{label}</Text>
      <View style={styles.filterItemRight}>
        <CountBadge count={count} />
        <ChevronRight />
      </View>
    </TouchableOpacity>
  );
}

interface FilterSectionProps {
  title: string;
  items: { label: string; filterKey: keyof FilterState; route: string }[];
}

function FilterSection({ title, items }: FilterSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionItems}>
        {items.map((item, index) => (
          <FilterItem
            key={index}
            label={item.label}
            filterKey={item.filterKey}
            onPress={() => router.push(item.route as any)}
          />
        ))}
      </View>
    </View>
  );
}

export default function FiltersScreen() {
  const { resetFilters, getTotalFilterCount } = useFilters();
  const totalCount = getTotalFilterCount();

  const handleReset = () => {
    resetFilters();
  };

  const handleApply = () => {
    // Apply filters and go back
    router.back();
  };

  const basicFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Brand', filterKey: 'brands', route: '/market/filters/brand' },
    { label: 'Model', filterKey: 'models', route: '/market/filters/model' },
    { label: 'Price', filterKey: 'priceMin', route: '/market/filters/price' },
    { label: 'Year of production', filterKey: 'years', route: '/market/filters/year' },
    { label: 'Location', filterKey: 'locations', route: '/market/filters/location' },
    { label: 'Reference Number', filterKey: 'references', route: '/market/filters/reference' },
  ];

  const conditionFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Delivery Contents', filterKey: 'deliveryContents', route: '/market/filters/delivery' },
    { label: 'Availability', filterKey: 'availability', route: '/market/filters/availability' },
    { label: 'New/Used', filterKey: 'conditionType', route: '/market/filters/condition-type' },
    { label: 'Condition', filterKey: 'condition', route: '/market/filters/condition' },
  ];

  const caseSizeFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Case diameter/width', filterKey: 'caseDiameter', route: '/market/filters/case-diameter' },
    { label: 'Lug width', filterKey: 'lugWidth', route: '/market/filters/lug-width' },
    { label: 'Case thickness', filterKey: 'caseThickness', route: '/market/filters/case-thickness' },
  ];

  const watchTypeFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Gender', filterKey: 'gender', route: '/market/filters/gender' },
    { label: 'Watch type', filterKey: 'watchType', route: '/market/filters/watch-type' },
    { label: 'Style of watch', filterKey: 'watchStyle', route: '/market/filters/watch-style' },
  ];

  const movementFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Movement', filterKey: 'movement', route: '/market/filters/movement' },
    { label: 'Functions', filterKey: 'functions', route: '/market/filters/functions' },
  ];

  const dialFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Dial style', filterKey: 'dialStyle', route: '/market/filters/dial-style' },
    { label: 'Dial color', filterKey: 'dialColor', route: '/market/filters/dial-color' },
  ];

  const caseFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Case material', filterKey: 'caseMaterial', route: '/market/filters/case-material' },
    { label: 'Bezel material', filterKey: 'bezelMaterial', route: '/market/filters/bezel-material' },
    { label: 'Crystal type', filterKey: 'crystalType', route: '/market/filters/crystal-type' },
    { label: 'Water resistance', filterKey: 'waterResistance', route: '/market/filters/water-resistance' },
  ];

  const strapFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Band material', filterKey: 'bandMaterial', route: '/market/filters/band-material' },
    { label: 'Band color', filterKey: 'bandColor', route: '/market/filters/band-color' },
  ];

  const claspFilters: { label: string; filterKey: keyof FilterState; route: string }[] = [
    { label: 'Clasp material', filterKey: 'claspMaterial', route: '/market/filters/clasp-material' },
    { label: 'Clasp type', filterKey: 'claspType', route: '/market/filters/clasp-type' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filter</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Filters */}
        <View style={styles.basicFilters}>
          {basicFilters.map((item, index) => (
            <FilterItem
              key={index}
              label={item.label}
              filterKey={item.filterKey}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>

        {/* Condition & Delivery Contents */}
        <FilterSection title="Condition & Delivery Contents" items={conditionFilters} />

        {/* Case size */}
        <FilterSection title="Case size" items={caseSizeFilters} />

        {/* Watch Type */}
        <FilterSection title="Watch Type" items={watchTypeFilters} />

        {/* Movement & Functions */}
        <FilterSection title="Movement & Functions" items={movementFilters} />

        {/* Dial */}
        <FilterSection title="Dial" items={dialFilters} />

        {/* Case */}
        <FilterSection title="Case" items={caseFilters} />

        {/* Strap / bracelet */}
        <FilterSection title="Strap / bracelet" items={strapFilters} />

        {/* Clasp */}
        <FilterSection title="Clasp" items={claspFilters} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.resetButton, totalCount === 0 && styles.resetButtonDisabled]}
          onPress={handleReset}
          disabled={totalCount === 0}
        >
          <Text style={[styles.resetButtonText, totalCount === 0 && styles.resetButtonTextDisabled]}>Reset</Text>
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
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
  },
  backButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.43,
  },
  headerSpacer: {
    width: sp(44),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(24),
  },
  basicFilters: {
    paddingTop: 0,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(16),
    paddingHorizontal: wp(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  filterItemText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
  },
  filterItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
  },
  countBadge: {
    backgroundColor: '#212121',
    borderRadius: sp(10),
    minWidth: sp(20),
    height: sp(20),
    paddingHorizontal: wp(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    color: '#FFFFFF',
    letterSpacing: 0.06,
  },
  section: {
    marginTop: hp(32),
  },
  sectionTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    fontWeight: '700',
    color: '#0F0D2D',
    letterSpacing: 0.09,
    paddingHorizontal: wp(16),
    marginBottom: 0,
  },
  sectionItems: {
    marginTop: 0,
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: wp(24),
    paddingVertical: hp(16),
    gap: wp(16),
  },
  resetButton: {
    flex: 1,
    height: hp(44),
    borderRadius: sp(99),
    borderWidth: 1,
    borderColor: '#212121',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonDisabled: {
    borderColor: 'rgba(33, 33, 33, 0.2)',
  },
  resetButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#212121',
    letterSpacing: 0.075,
  },
  resetButtonTextDisabled: {
    color: 'rgba(33, 33, 33, 0.3)',
  },
  applyButton: {
    flex: 1,
    height: hp(44),
    borderRadius: sp(99),
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.075,
  },
});
