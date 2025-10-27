import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, ChevronRight, Heart } from '@/components/icons';
import { StatsCard } from '@/components/StatsCard';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { WatchImageCard } from '@/components/WatchImageCard';
import { OrderBookModal } from '@/components/OrderBookModal';

// Mock order book data
const mockBuyOrders = [
  { date: '10.10.25', condition: 'Pristine', price: '€12,852' },
  { date: '10.18.25', condition: 'Restored', price: '€12,852' },
  { date: '10.10.25', condition: 'Mint Condition', price: '€12,852' },
  { date: '10.10.25', condition: 'Lightly Worn', price: '€12,852' },
  { date: '10.10.25', condition: 'Like New', price: '€12,852' },
  { date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { date: '10.10.25', condition: 'Showcase Model', price: '€12,852' },
  { date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { date: '10.10.25', condition: 'Lightly Used', price: '€12,852' },
  { date: '10.10.25', condition: 'Gently Worn', price: '€12,852' },
  { date: '10.10.25', condition: 'Well Maintained', price: '€12,852' },
  { date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { date: '10.10.25', condition: 'Unworn with Box', price: '€12,852' },
  { date: '10.10.25', condition: 'Limited Edition', price: '€12,852' },
  { date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { date: '10.10.25', condition: 'Minor Scratches', price: '€12,852' },
  { date: '10.10.25', condition: 'Refurbished', price: '€12,852' },
  { date: '10.10.25', condition: 'Damaged', price: '€12,852' },
];

export default function WatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTimeRange, setActiveTimeRange] = useState('1YR');
  const [showOrderBook, setShowOrderBook] = useState(false);

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

  const mockListings = [
    { id: '1', title: 'Rolex Submariner Date', subtitle: '126610LN, New Unworn 41...', price: '€12,352' },
    { id: '2', title: 'Rolex Submariner Date', subtitle: '126610LN, New Unworn 41...', price: '€12,352' },
    { id: '3', title: 'Rolex Submariner Date', subtitle: '126610LN, New Unworn 41...', price: '€12,352' },
    { id: '4', title: 'Rolex Submariner Date', subtitle: '126610LN, New Unworn 41...', price: '€12,352' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.orderBookButton} onPress={() => setShowOrderBook(true)}>
          <Text style={styles.orderBookText}>See Order Book</Text>
          <ChevronRight size={20} color="#000000" />
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
              color={isFavorite ? '#FF3B30' : '#000000'}
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
            <Text style={styles.buyButtonText}>{watchData.buyPrice} Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sellButton}>
            <Text style={styles.sellButtonText}>{watchData.sellPrice} Sell</Text>
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

        {/* Listings Section */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>Listings</Text>
          <View style={styles.listingsGrid}>
            {mockListings.map((listing) => (
              <WatchImageCard
                key={listing.id}
                title={listing.title}
                subtitle={listing.subtitle}
                price={listing.price}
                onPress={() => {}}
                onFavoritePress={() => {}}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Order Book Modal */}
      <OrderBookModal
        visible={showOrderBook}
        onClose={() => setShowOrderBook(false)}
        buyOrders={mockBuyOrders}
        sellOrders={mockBuyOrders}
      />
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
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  orderBookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderBookText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5EA',
  },
  favoriteButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoSection: {
    padding: 16,
  },
  watchTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  watchSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  statsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sellButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  priceHistorySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  chartContainer: {
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  listingsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
