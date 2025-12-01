import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageSourcePropType, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, ChevronDown, Filter, Check } from '@/components/icons';
import { OrderBookModal } from '@/components/OrderBookModal';

// Watch data with images
const WATCH_DATA: Record<string, {
  brand: string;
  model: string;
  reference: string;
  fullName: string;
  image: ImageSourcePropType;
  bestBid: number;
  bestAsk: number;
}> = {
  '1': {
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    reference: '26240OR Blue',
    fullName: 'Audemars Piguet Royal Oak',
    image: require('../../assets/images/ap.jpeg'),
    bestBid: 104500,
    bestAsk: 107200,
  },
  '2': {
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '7118/1200R White',
    fullName: 'Patek Philippe Nautilus',
    image: require('../../assets/images/patek.jpeg'),
    bestBid: 165000,
    bestAsk: 171500,
  },
  '3': {
    brand: 'Rolex',
    model: 'GMT-Master II',
    reference: '126710BLRO Jubilee',
    fullName: 'Rolex GMT-Master II',
    image: require('../../assets/images/rolex.jpeg'),
    bestBid: 20200,
    bestAsk: 21400,
  },
  '4': {
    brand: 'Rolex',
    model: 'Day-Date 40',
    reference: '228238A Black',
    fullName: 'Rolex Day-Date 40',
    image: require('../../assets/images/rolex-gold.jpeg'),
    bestBid: 53800,
    bestAsk: 56500,
  },
};

// Available years for dropdown
const AVAILABLE_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

// Market options
const MARKET_OPTIONS = [
  { id: 'all', label: 'All Markets' },
  { id: 'us', label: 'United States', flag: '🇺🇸' },
  { id: 'eu', label: 'European Union', flag: '🇪🇺' },
  { id: 'uae', label: 'UAE', flag: '🇦🇪' },
  { id: 'hk', label: 'Hong Kong', flag: '🇭🇰' },
];

// Payment method options
const PAYMENT_OPTIONS = [
  { id: 'all', label: 'All Payment Methods' },
  { id: 'wire', label: 'Wire Transfer' },
  { id: 'crypto', label: 'Cryptocurrency' },
  { id: 'escrow', label: 'Escrow' },
];

// Tax options
const TAX_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'included', label: 'Tax Included' },
  { id: 'excluded', label: 'Tax Excluded' },
];

type Condition = 'unworn' | 'used';

// Sample order book data
const SAMPLE_BUY_ORDERS = [
  { country: 'US' as const, date: '12/01', condition: 'Unworn', price: '€104,500' },
  { country: 'EU' as const, date: '11/28', condition: 'Unworn', price: '€103,800' },
  { country: 'UAE' as const, date: '11/25', condition: 'Used', price: '€98,200' },
  { country: 'HK' as const, date: '11/22', condition: 'Unworn', price: '€102,000' },
];

const SAMPLE_SELL_ORDERS = [
  { country: 'EU' as const, date: '12/01', condition: 'Unworn', price: '€107,200' },
  { country: 'US' as const, date: '11/30', condition: 'Unworn', price: '€108,500' },
  { country: 'HK' as const, date: '11/28', condition: 'Used', price: '€105,000' },
  { country: 'UAE' as const, date: '11/26', condition: 'Unworn', price: '€109,800' },
];

export default function MarketDetailScreen() {
  const { colors, fonts } = useTheme();
  const { id } = useLocalSearchParams();
  const watchId = typeof id === 'string' ? id : '1';

  const [condition, setCondition] = useState<Condition>('unworn');
  const [selectedYear, setSelectedYear] = useState(2025);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(false);

  // Filter states
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState('all');
  const [selectedTax, setSelectedTax] = useState('all');

  // Get watch data or use default
  const watch = WATCH_DATA[watchId] || WATCH_DATA['1'];

  // Calculate spread
  const spread = watch.bestAsk - watch.bestBid;

  // Format currency
  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('en-US')}`;
  };

  // Count active filters
  const activeFilterCount = [selectedMarket, selectedPayment, selectedTax].filter(f => f !== 'all').length;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    backButton: {
      padding: 4,
    },
    orderBookLink: {
      paddingVertical: 4,
    },
    orderBookLinkText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    headerTitleContainer: {
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    scrollView: {
      flex: 1,
    },

    // Hero Section
    heroSection: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    watchImageContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 20,
      overflow: 'hidden',
    },
    watchImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },

    // Filters Section
    filtersSection: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
    },

    // Condition Segmented Control
    conditionControl: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      padding: 3,
    },
    conditionButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
    },
    conditionButtonActive: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    conditionText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    conditionTextActive: {
      color: colors.text,
      fontFamily: fonts.semiBold,
    },

    // Year Selector
    yearSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    yearText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },

    // Add Filters Button
    addFiltersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 10,
      gap: 6,
    },
    addFiltersText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    filterBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 4,
    },
    filterBadgeText: {
      fontSize: 11,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },

    // Market Overview Section
    marketSection: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 12,
    },
    marketGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    marketCard: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    marketLabel: {
      fontSize: 13,
      fontFamily: fonts.bold,
      color: colors.text,
      marginBottom: 6,
    },
    marketValue: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.text,
    },

    // Order Buttons Section
    orderSection: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    orderButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    buyButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: '#4AA078',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4AA078',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buyButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    sellButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: '#CC6045',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#CC6045',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    sellButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },

    // Info Note
    infoNote: {
      marginTop: 16,
      padding: 14,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    infoNoteText: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 36,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 2.5,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    modalOptionText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    modalOptionSelected: {
      fontFamily: fonts.semiBold,
    },
    modalOptionFlag: {
      fontSize: 18,
      marginRight: 10,
    },
    modalOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // Filters Modal
    filterSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    filterSectionTitle: {
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    filterOptionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    filterChipSelected: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    filterChipTextSelected: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
    },
    filterApplyButton: {
      marginHorizontal: 20,
      marginTop: 10,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    filterApplyButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    filterResetButton: {
      marginHorizontal: 20,
      marginTop: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    filterResetButtonText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
  }), [colors, fonts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.orderBookLink} onPress={() => setShowOrderBook(true)}>
            <Text style={styles.orderBookLinkText}>Order Book</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{watch.fullName}</Text>
          <Text style={styles.headerSubtitle}>{watch.reference}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 1. Hero Section - Watch Image */}
        <View style={styles.heroSection}>
          <View style={styles.watchImageContainer}>
            <Image source={watch.image} style={styles.watchImage} />
          </View>
        </View>

        {/* 2. Primary Filters */}
        <View style={styles.filtersSection}>
          <View style={styles.filterRow}>
            {/* Condition Segmented Control */}
            <View style={styles.conditionControl}>
              <TouchableOpacity
                style={[styles.conditionButton, condition === 'unworn' && styles.conditionButtonActive]}
                onPress={() => setCondition('unworn')}
              >
                <Text style={[styles.conditionText, condition === 'unworn' && styles.conditionTextActive]}>
                  Unworn
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.conditionButton, condition === 'used' && styles.conditionButtonActive]}
                onPress={() => setCondition('used')}
              >
                <Text style={[styles.conditionText, condition === 'used' && styles.conditionTextActive]}>
                  Used
                </Text>
              </TouchableOpacity>
            </View>

            {/* Year Selector */}
            <TouchableOpacity style={styles.yearSelector} onPress={() => setShowYearModal(true)}>
              <Text style={styles.yearText}>{selectedYear}</Text>
              <ChevronDown size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Add Filters Button */}
          <TouchableOpacity style={styles.addFiltersButton} onPress={() => setShowFiltersModal(true)}>
            <Filter size={16} color={colors.textSecondary} />
            <Text style={styles.addFiltersText}>Add Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Market Overview (Top-of-Book Data) */}
        <View style={styles.marketSection}>
          <Text style={styles.sectionTitle}>Market Overview</Text>

          <View style={styles.marketGrid}>
            {/* Best Bid */}
            <View style={styles.marketCard}>
              <Text style={styles.marketLabel}>Best Bid</Text>
              <Text style={styles.marketValue}>{formatPrice(watch.bestBid)}</Text>
            </View>

            {/* Best Ask */}
            <View style={styles.marketCard}>
              <Text style={styles.marketLabel}>Best Ask</Text>
              <Text style={styles.marketValue}>{formatPrice(watch.bestAsk)}</Text>
            </View>

            {/* Spread */}
            <View style={styles.marketCard}>
              <Text style={styles.marketLabel}>Spread</Text>
              <Text style={styles.marketValue}>{formatPrice(spread)}</Text>
            </View>
          </View>
        </View>

        {/* 4. Order Placement Buttons */}
        <View style={styles.orderSection}>
          <View style={styles.orderButtons}>
            <TouchableOpacity style={styles.buyButton} activeOpacity={0.8}>
              <Text style={styles.buyButtonText}>Place Buy Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sellButton} activeOpacity={0.8}>
              <Text style={styles.sellButtonText}>Place Sell Order</Text>
            </TouchableOpacity>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Orders are matched based on the selected condition and year. Your order will be visible to all verified dealers in the market.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Year Selection Modal */}
      <Modal
        visible={showYearModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Year</Text>
            <ScrollView>
              {AVAILABLE_YEARS.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowYearModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedYear === year && styles.modalOptionSelected
                  ]}>
                    {year}
                  </Text>
                  {selectedYear === year && <Check size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Additional Filters Modal */}
      <Modal
        visible={showFiltersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFiltersModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filters</Text>

            <ScrollView>
              {/* Market Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Market</Text>
                <View style={styles.filterOptionRow}>
                  {MARKET_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterChip,
                        selectedMarket === option.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedMarket(option.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedMarket === option.id && styles.filterChipTextSelected
                      ]}>
                        {option.flag ? `${option.flag} ${option.label}` : option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Method Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Payment Method</Text>
                <View style={styles.filterOptionRow}>
                  {PAYMENT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterChip,
                        selectedPayment === option.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedPayment(option.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedPayment === option.id && styles.filterChipTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Tax Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Tax</Text>
                <View style={styles.filterOptionRow}>
                  {TAX_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterChip,
                        selectedTax === option.id && styles.filterChipSelected
                      ]}
                      onPress={() => setSelectedTax(option.id)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedTax === option.id && styles.filterChipTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Apply Button */}
            <TouchableOpacity
              style={styles.filterApplyButton}
              onPress={() => setShowFiltersModal(false)}
            >
              <Text style={styles.filterApplyButtonText}>Apply Filters</Text>
            </TouchableOpacity>

            {/* Reset Button */}
            <TouchableOpacity
              style={styles.filterResetButton}
              onPress={() => {
                setSelectedMarket('all');
                setSelectedPayment('all');
                setSelectedTax('all');
              }}
            >
              <Text style={styles.filterResetButtonText}>Reset All</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Order Book Modal */}
      <OrderBookModal
        visible={showOrderBook}
        onClose={() => setShowOrderBook(false)}
        buyOrders={SAMPLE_BUY_ORDERS}
        sellOrders={SAMPLE_SELL_ORDERS}
      />
    </SafeAreaView>
  );
}
