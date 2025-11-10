import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, ChevronRight, Heart, MoreVertical, X, Check } from '@/components/icons';
import { StatsCard } from '@/components/StatsCard';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { OrderBookModal } from '@/components/OrderBookModal';

// Mock order book data
const mockBuyOrders = [
  { country: 'US' as const, date: '10.10.25', condition: 'Pristine', price: '€12,852' },
  { country: 'EU' as const, date: '10.18.25', condition: 'Restored', price: '€12,852' },
  { country: 'UAE' as const, date: '10.10.25', condition: 'Mint Condition', price: '€12,852' },
  { country: 'HK' as const, date: '10.10.25', condition: 'Lightly Worn', price: '€12,852' },
  { country: 'US' as const, date: '10.10.25', condition: 'Like New', price: '€12,852' },
  { country: 'EU' as const, date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { country: 'UAE' as const, date: '10.10.25', condition: 'Showcase Model', price: '€12,852' },
  { country: 'HK' as const, date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { country: 'US' as const, date: '10.10.25', condition: 'Lightly Used', price: '€12,852' },
  { country: 'EU' as const, date: '10.10.25', condition: 'Gently Worn', price: '€12,852' },
  { country: 'UAE' as const, date: '10.10.25', condition: 'Well Maintained', price: '€12,852' },
  { country: 'HK' as const, date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { country: 'US' as const, date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { country: 'EU' as const, date: '10.10.25', condition: 'Limited Edition', price: '€12,852' },
  { country: 'UAE' as const, date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { country: 'HK' as const, date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { country: 'US' as const, date: '10.10.25', condition: 'Refurbished', price: '€12,852' },
  { country: 'EU' as const, date: '10.10.25', condition: 'Damaged', price: '€12,852' },
];

export default function WatchDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams();
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTimeRange, setActiveTimeRange] = useState('1YR');
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [showMakeOfferModal, setShowMakeOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('12,352');
  const [showOfferSuccess, setShowOfferSuccess] = useState(false);

  const timeRanges = ['All', '1M', '3M', '6M', '1YR', 'YTD'];

  // Mock data
  const watchData = {
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    condition: 'New Unworn 41mm',
    lastTrade: '€12,852',
    highestBid: '€15,215',
    listings: '125',
    buyPrice: '€12,900',
    sellPrice: '€13,100',
  };

  const stats = [
    { label: 'Last trade', value: watchData.lastTrade },
    { label: 'Highest bid', value: watchData.highestBid },
    { label: 'Listings', value: watchData.listings },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerButton: {
      padding: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    orderBookButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    orderBookText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    imageContainer: {
      width: '100%',
      aspectRatio: 1,
      padding: 16,
      position: 'relative',
    },
    imagePlaceholder: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
    },
    favoriteButton: {
      position: 'absolute',
      top: 24,
      right: 24,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    infoSection: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    watchTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    watchSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    statsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    actionButtons: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 12,
    },
    buyButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
    },
    sellButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sellButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    priceHistorySection: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    chartContainer: {
      marginBottom: 16,
    },
    chartPlaceholder: {
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
    },
    // Make Offer Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 40,
      paddingHorizontal: 24,
      minHeight: 400,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalWatchCard: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    modalWatchImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    modalWatchInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    modalWatchTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    modalWatchPrice: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    offerSection: {
      marginBottom: 32,
    },
    offerLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    offerInput: {
      fontSize: 24,
      fontWeight: '400',
      color: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    sendButton: {
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
    },
    sendButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
    },
    // Success Modal Styles
    successModalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 40,
      paddingBottom: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
      minHeight: 300,
    },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#E3F2FD',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    successText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    successAmount: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.orderBookButton} onPress={() => setShowOrderBook(true)}>
          <Text style={styles.orderBookText}>See Order Book</Text>
          <ChevronRight size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Watch Image */}
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder} />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => setIsFavorite(!isFavorite)}
          >
            <Heart
              size={24}
              color={isFavorite ? '#FF3B30' : colors.text}
              fill={isFavorite ? '#FF3B30' : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Watch Info */}
        <View style={styles.infoSection}>
          <Text style={styles.watchTitle}>{watchData.brand} {watchData.model}</Text>
          <Text style={styles.watchSubtitle}>
            {watchData.reference}, {watchData.condition}
          </Text>
        </View>

        {/* Stats Card */}
        <View style={styles.statsContainer}>
          <StatsCard stats={stats} />
        </View>

        {/* Buy/Sell Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.buyButton}>
            <Text style={styles.buyButtonText}>Buy Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sellButton} onPress={() => setShowMakeOfferModal(true)}>
            <Text style={styles.sellButtonText}>Make offer</Text>
          </TouchableOpacity>
        </View>

        {/* Price History */}
        <View style={styles.priceHistorySection}>
          <Text style={styles.sectionTitle}>Price History</Text>

          {/* Chart Placeholder */}
          <View style={styles.chartContainer}>
            <View style={styles.chartPlaceholder} />
          </View>

          {/* Time Range Selector */}
          <TimeRangeSelector
            ranges={timeRanges}
            activeRange={activeTimeRange}
            onRangeSelect={setActiveTimeRange}
          />
        </View>

      </ScrollView>

      {/* Order Book Modal */}
      <OrderBookModal
        visible={showOrderBook}
        onClose={() => setShowOrderBook(false)}
        buyOrders={mockBuyOrders}
        sellOrders={mockBuyOrders}
      />

      {/* Make Offer Modal */}
      <Modal
        visible={showMakeOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMakeOfferModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMakeOfferModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Make an offer</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowMakeOfferModal(false)}
                >
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalWatchCard}>
                <View style={styles.modalWatchImage} />
                <View style={styles.modalWatchInfo}>
                  <Text style={styles.modalWatchTitle}>{watchData.brand} {watchData.model}</Text>
                  <Text style={styles.modalWatchPrice}>€12,352</Text>
                </View>
              </View>

              <View style={styles.offerSection}>
                <Text style={styles.offerLabel}>Your offer</Text>
                <Text style={styles.offerInput}>€  {offerAmount}</Text>
              </View>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => {
                  setShowMakeOfferModal(false);
                  setTimeout(() => setShowOfferSuccess(true), 300);
                }}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Offer Success Modal */}
      <Modal
        visible={showOfferSuccess}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferSuccess(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOfferSuccess(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.successModalContent}>
              <View style={styles.successIcon}>
                <Check size={40} color="#2196F3" />
              </View>
              <Text style={styles.successText}>Offer sent</Text>
              <Text style={styles.successAmount}>€10,000</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
