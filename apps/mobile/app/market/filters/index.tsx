import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { useFilters, FilterState } from '@/contexts/FilterContext';
import { useConfig } from '@/contexts/ConfigContext';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useTranslation } from 'react-i18next';

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
  if (items.length === 0) return null;

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

// Map backend filter key to FilterState key
const BACKEND_KEY_TO_FILTER_KEY: Record<string, keyof FilterState> = {
  brand: 'brands',
  model: 'models',
  year: 'years',
  location: 'locations',
  price: 'priceMin',
  reference: 'references',
  delivery: 'deliveryContents',
  availability: 'availability',
  condition_type: 'conditionType',
  condition: 'condition',
  case_diameter: 'caseDiameter',
  lug_width: 'lugWidth',
  case_thickness: 'caseThickness',
  gender: 'gender',
  watch_type: 'watchType',
  watch_style: 'watchStyle',
  movement: 'movement',
  functions: 'functions',
  dial_style: 'dialStyle',
  dial_color: 'dialColor',
  case_material: 'caseMaterial',
  bezel_material: 'bezelMaterial',
  crystal_type: 'crystalType',
  water_resistance: 'waterResistance',
  band_material: 'bandMaterial',
  band_color: 'bandColor',
  clasp_material: 'claspMaterial',
  clasp_type: 'claspType',
};

// Map backend filter key to URL route segment
const BACKEND_KEY_TO_ROUTE: Record<string, string> = {
  brand: 'brand',
  model: 'model',
  year: 'year',
  location: 'location',
  price: 'price',
  reference: 'reference',
  delivery: 'delivery',
  availability: 'availability',
  condition_type: 'condition-type',
  condition: 'condition',
  case_diameter: 'case-diameter',
  lug_width: 'lug-width',
  case_thickness: 'case-thickness',
  gender: 'gender',
  watch_type: 'watch-type',
  watch_style: 'watch-style',
  movement: 'movement',
  functions: 'functions',
  dial_style: 'dial-style',
  dial_color: 'dial-color',
  case_material: 'case-material',
  bezel_material: 'bezel-material',
  crystal_type: 'crystal-type',
  water_resistance: 'water-resistance',
  band_material: 'band-material',
  band_color: 'band-color',
  clasp_material: 'clasp-material',
  clasp_type: 'clasp-type',
};

export default function FiltersScreen() {
  const { t } = useTranslation();
  const { resetFilters, getTotalFilterCount } = useFilters();
  const { marketFilters, loadMarketFilters, isLoadingMarketFilters } = useConfig();
  const totalCount = getTotalFilterCount();

  // Load market filters on mount
  useEffect(() => {
    loadMarketFilters();
  }, [loadMarketFilters]);

  // Convert filters to UI format and group by section
  const filtersBySection = useMemo(() => {
    const sections: Record<string, { label: string; filterKey: keyof FilterState; route: string }[]> = {
      basic: [], // watch + price sections go here
      condition: [],
      case_size: [],
      watch_type: [],
      caliber: [],
      dial: [],
      case: [],
      band: [],
      clasp: [],
    };

    // Sort filters by display_order
    const sortedFilters = [...marketFilters].sort((a, b) => a.display_order - b.display_order);

    for (const filter of sortedFilters) {
      const filterKey = BACKEND_KEY_TO_FILTER_KEY[filter.key];
      const routeSegment = BACKEND_KEY_TO_ROUTE[filter.key];

      if (!filterKey || !routeSegment) continue;

      const item = {
        label: filter.name,
        filterKey,
        route: `/market/filters/${routeSegment}`,
      };

      // Map ui_section to our section keys
      const uiSection = filter.ui_section || 'watch';

      if (uiSection === 'watch' || uiSection === 'price') {
        sections.basic.push(item);
      } else if (uiSection === 'condition') {
        sections.condition.push(item);
      } else if (uiSection === 'case_size') {
        sections.case_size.push(item);
      } else if (uiSection === 'watch_type') {
        sections.watch_type.push(item);
      } else if (uiSection === 'caliber') {
        sections.caliber.push(item);
      } else if (uiSection === 'dial') {
        sections.dial.push(item);
      } else if (uiSection === 'case') {
        sections.case.push(item);
      } else if (uiSection === 'band') {
        sections.band.push(item);
      } else if (uiSection === 'clasp') {
        sections.clasp.push(item);
      } else {
        // Default to basic if unknown section
        sections.basic.push(item);
      }
    }

    return sections;
  }, [marketFilters]);

  const handleReset = () => {
    resetFilters();
  };

  const handleApply = () => {
    router.back();
  };

  // Show loading state
  if (isLoadingMarketFilters && marketFilters.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('filters.filter')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingAnimation />
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
        <Text style={styles.headerTitle}>{t('filters.filter')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Filters (watch + price sections) */}
        {filtersBySection.basic.length > 0 && (
          <View style={styles.basicFilters}>
            {filtersBySection.basic.map((item, index) => (
              <FilterItem
                key={index}
                label={item.label}
                filterKey={item.filterKey}
                onPress={() => router.push(item.route as any)}
              />
            ))}
          </View>
        )}

        {/* Condition & Delivery Contents */}
        <FilterSection title={t('filters.conditionDelivery')} items={filtersBySection.condition} />

        {/* Case size */}
        <FilterSection title={t('filters.caseSize')} items={filtersBySection.case_size} />

        {/* Watch Type */}
        <FilterSection title={t('filters.watchType')} items={filtersBySection.watch_type} />

        {/* Movement & Functions */}
        <FilterSection title={t('filters.movementFunctions')} items={filtersBySection.caliber} />

        {/* Dial */}
        <FilterSection title={t('filters.dial')} items={filtersBySection.dial} />

        {/* Case */}
        <FilterSection title={t('filters.case')} items={filtersBySection.case} />

        {/* Strap / bracelet */}
        <FilterSection title={t('filters.strapBracelet')} items={filtersBySection.band} />

        {/* Clasp */}
        <FilterSection title={t('filters.clasp')} items={filtersBySection.clasp} />
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.resetButton, totalCount === 0 && styles.resetButtonDisabled]}
          onPress={handleReset}
          disabled={totalCount === 0}
        >
          <Text style={[styles.resetButtonText, totalCount === 0 && styles.resetButtonTextDisabled]}>{t('filters.reset')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>{t('filters.apply')}</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
