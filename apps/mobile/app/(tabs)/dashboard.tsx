import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { api } from '@/services/api';
import { LogoIcon } from '@/components/LogoIcon';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = wp(16);
const CARD_GAP = wp(12);
// Calculate card width: (screen width - left padding - right padding - gap between cards) / 2
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

// Plus Icon
function PlusIcon() {
  return (
    <Svg width={sp(18)} height={sp(18)} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 3V15M3 9H15"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Watch Icon for Empty State
function WatchIcon({ size = 32, color = '#1D1D1F' }: { size?: number; color?: string }) {
  return (
    <Svg width={sp(size)} height={sp(size)} viewBox="0 0 32 32" fill="none">
      <Path
        d="M10 8L11.33 2.67H20.67L22 8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 24L11.33 29.33H20.67L22 24"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={16}
        cy={16}
        r={10}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 10V16L19.5 19.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Small Watch Icon for "No buy orders" button
function SmallWatchIcon() {
  return (
    <Svg width={sp(14)} height={sp(14)} viewBox="0 0 32 32" fill="none">
      <Path
        d="M10 8L11.33 2.67H20.67L22 8"
        stroke="rgba(33, 33, 33, 0.5)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 24L11.33 29.33H20.67L22 24"
        stroke="rgba(33, 33, 33, 0.5)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={16}
        cy={16}
        r={10}
        stroke="rgba(33, 33, 33, 0.5)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 10V16L19.5 19.5"
        stroke="rgba(33, 33, 33, 0.5)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Search/Magnifier Icon
function SearchIcon() {
  return (
    <Svg width={sp(18)} height={sp(18)} viewBox="0 0 18 18" fill="none">
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

// Trend Up Icon
function TrendUpIcon() {
  return (
    <Svg width={sp(12)} height={sp(12)} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1 8.5L4.5 5L7 7.5L11 3.5"
        stroke="#4AA078"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 3.5H11V6.5"
        stroke="#4AA078"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Trend Down Icon
function TrendDownIcon() {
  return (
    <Svg width={sp(12)} height={sp(12)} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1 3.5L4.5 7L7 4.5L11 8.5"
        stroke="#C93927"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 8.5H11V5.5"
        stroke="#C93927"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface InventoryWatch {
  id: string;
  watch_id?: string;
  brand: string;
  model: string;
  displayName: string; // Combined brand + model for display
  reference: string;
  soldOrder: string;
  rawPrice: number;
  change: string;
  isPositive: boolean;
  sellNowPrice: string | null;
  image: string;
  status?: string;
  condition?: string;
  country_code?: string;
  country_name?: string;
  has_box?: boolean;
  has_papers?: boolean;
}

export default function DashboardScreen() {
  // Start with empty array - data will be loaded from API
  const [inventory, setInventory] = useState<InventoryWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [])
  );

  const loadInventory = async () => {
    try {
      // Load sell orders for the current user (inventory = user's sell orders)
      // Use order_type=sell query param to only get sell orders
      const response = await api.get('/orders/my-orders', {
        params: { order_type: 'sell' }
      });
      if (response.data && Array.isArray(response.data)) {
        const sellOrders = response.data;

        const formattedInventory: InventoryWatch[] = sellOrders.map((order: any) => ({
          id: order.id || order._id,
          watch_id: order.watch_id,
          brand: order.brand || '',
          model: order.model || '',
          displayName: `${order.brand} ${order.model || ''}`.trim(),
          reference: order.reference || '',
          soldOrder: order.price ? `${order.price.toLocaleString('de-DE')}€` : '0€',
          rawPrice: order.price || 0,
          change: order.price_change ? `${Math.abs(order.price_change).toFixed(1).replace('.', ',')}%` : '0%',
          isPositive: (order.price_change || 0) >= 0,
          sellNowPrice: order.best_bid ? `€${order.best_bid.toLocaleString('de-DE')}` : null,
          image: order.cover_image || '',
          status: order.status || 'active',
          condition: order.condition || 'Used',
          country_code: order.country_code || 'US',
          country_name: order.country_name || '',
          has_box: order.has_box || false,
          has_papers: order.has_papers || false,
        }));
        setInventory(formattedInventory);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  }, []);

  // Calculate total inventory value
  const totalValue = inventory.reduce((sum, watch) => {
    const price = parseFloat(watch.soldOrder.replace(/[€,]/g, '').replace('.', ''));
    return sum + price;
  }, 0);

  // Filter inventory based on search query
  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const query = searchQuery.toLowerCase();
    return inventory.filter(watch =>
      watch.displayName.toLowerCase().includes(query) ||
      watch.reference.toLowerCase().includes(query)
    );
  }, [inventory, searchQuery]);

  // Navigate to create listing
  const handleCreateListing = useCallback(() => {
    router.push('/listing/create');
  }, []);

  const isSold = (status?: string) => status === 'sold';

  const handleWatchCardPress = useCallback((watch: InventoryWatch) => {
    // Navigate to order detail screen (watch-details) with order parameters
    // This shows the order detail view with edit/mark-sold/delete options for the owner
    router.push({
      pathname: '/market/watch-details',
      params: {
        orderId: watch.id,
        reference: watch.reference || '',
        brand: watch.brand,
        model: watch.model,
        price: watch.rawPrice.toString(),
        condition: watch.condition || 'Used',
        country_code: watch.country_code || 'US',
        country_name: watch.country_name || '',
        has_box: (watch.has_box || false).toString(),
        has_papers: (watch.has_papers || false).toString(),
        user_name: '',
        user_id: '',
        order_type: 'sell',
        fromOrderBook: 'false',
      },
    } as any);
  }, []);

  const renderWatchCard = (watch: InventoryWatch) => (
    <TouchableOpacity
      key={watch.id}
      style={styles.watchCard}
      onPress={() => handleWatchCardPress(watch)}
      activeOpacity={0.7}
    >
      {/* Watch Image */}
      <View style={styles.watchImageContainer}>
        <LinearGradient
          colors={['#FFFFFF', '#F4F4F4']}
          style={styles.watchImageGradient}
        >
          {watch.image ? (
            <Image
              source={{ uri: watch.image }}
              style={styles.watchImage}
              resizeMode="contain"
            />
          ) : (
            <LogoIcon size={sp(40)} color="rgba(33, 33, 33, 0.15)" />
          )}
        </LinearGradient>
        {/* Sold Badge */}
        {isSold(watch.status) && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldBadgeText}>Sold</Text>
          </View>
        )}
      </View>

      {/* Watch Info */}
      <View style={styles.watchInfo}>
        <View style={styles.watchDetails}>
          {/* Brand and Reference */}
          <View style={styles.watchNameContainer}>
            <Text style={styles.watchBrand} numberOfLines={1}>{watch.displayName}</Text>
            <Text style={styles.watchReference} numberOfLines={1}>{watch.reference}</Text>
          </View>

          {/* Price Row */}
          <View style={styles.watchPriceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.soldOrderLabel}>Sell order:</Text>
              <Text style={styles.soldOrderPrice}>{watch.soldOrder}</Text>
            </View>
            <View style={[
              styles.changeBadge,
              { backgroundColor: watch.isPositive ? 'rgba(74, 160, 120, 0.05)' : 'rgba(201, 57, 39, 0.05)' }
            ]}>
              {watch.isPositive ? <TrendUpIcon /> : <TrendDownIcon />}
              <Text style={[
                styles.changeText,
                { color: watch.isPositive ? '#4AA078' : '#C93927' }
              ]}>{watch.change}</Text>
            </View>
          </View>
        </View>

        {/* Sell Now / No Buy Orders Button - only show for active orders */}
        {!isSold(watch.status) && (
          <View style={styles.sellButtonContainer}>
            {watch.sellNowPrice ? (
              <TouchableOpacity
                style={styles.sellNowButton}
                activeOpacity={0.8}
                onPress={(e) => {
                  e.stopPropagation();
                  // Navigate to watch details page for this reference
                  router.push({
                    pathname: '/market/[id]',
                    params: {
                      id: watch.reference,
                      reference: watch.reference,
                      brand: watch.brand,
                      model: watch.model,
                    },
                  } as any);
                }}
              >
                <Text style={styles.sellNowButtonText}>Sell now {watch.sellNowPrice}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.noBuyOrdersButton}
                activeOpacity={0.8}
                onPress={(e) => {
                  e.stopPropagation();
                  // Navigate to watch details page for this reference
                  router.push({
                    pathname: '/market/[id]',
                    params: {
                      id: watch.reference,
                      reference: watch.reference,
                      brand: watch.brand,
                      model: watch.model,
                    },
                  } as any);
                }}
              >
                <SmallWatchIcon />
                <Text style={styles.noBuyOrdersText}>No buy orders</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyIconContainer}>
        <WatchIcon />
      </View>
      <View style={styles.emptyTextContainer}>
        <Text style={styles.emptyTitle}>Create new listings here</Text>
        <Text style={styles.emptySubtitle}>
          Listing currently empty, list your watches and manage them all in one place.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.createListingButton}
        onPress={handleCreateListing}
        activeOpacity={0.8}
      >
        <Text style={styles.createListingButtonText}>Create new listing</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPopulatedState = () => (
    <View style={styles.populatedContainer}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>€{totalValue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total inventory value</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{inventory.length}</Text>
          <Text style={styles.statLabel}>Listed watches</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory"
          placeholderTextColor="rgba(33, 33, 33, 0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Watch Grid */}
      <View style={styles.watchGrid}>
        {filteredInventory.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No watches match your search</Text>
          </View>
        ) : (
          <View style={styles.watchGridContainer}>
            {filteredInventory.map(renderWatchCard)}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SubscriptionOverlay feature="orders">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        {inventory.length === 0 ? (
          // Empty state header with centered title
          <View style={styles.headerEmpty}>
            <Text style={styles.headerTitleCentered}>Inventory</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleCreateListing}
              activeOpacity={0.7}
            >
              <PlusIcon />
            </TouchableOpacity>
          </View>
        ) : (
          // Populated state header with left-aligned title
          <View style={styles.headerPopulated}>
            <Text style={styles.headerTitleLeft}>Inventory</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleCreateListing}
              activeOpacity={0.7}
            >
              <PlusIcon />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#212121" />
            </View>
          ) : inventory.length === 0 ? (
            renderEmptyState()
          ) : (
            renderPopulatedState()
          )}
        </ScrollView>
      </SafeAreaView>
    </SubscriptionOverlay>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Empty state header
  headerEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    position: 'relative',
  },
  headerTitleCentered: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    fontWeight: '600',
    color: '#212121',
    letterSpacing: 0.09,
    lineHeight: fp(20),
  },
  // Populated state header
  headerPopulated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  headerTitleLeft: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    fontWeight: '700',
    color: '#212121',
    letterSpacing: 0.12,
    lineHeight: fp(32),
  },
  addButton: {
    width: sp(32),
    height: sp(32),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: wp(8),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: hp(120),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(100),
  },
  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(16),
  },
  emptyIconContainer: {
    width: sp(64),
    height: sp(64),
    borderRadius: sp(80),
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextContainer: {
    alignItems: 'center',
    marginTop: hp(24),
    width: wp(278),
  },
  emptyTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(20),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(26),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    fontWeight: '400',
    color: '#1D1D1F',
    opacity: 0.6,
    lineHeight: fp(20),
    textAlign: 'center',
    marginTop: hp(12),
  },
  createListingButton: {
    backgroundColor: '#212121',
    paddingHorizontal: wp(33),
    paddingVertical: hp(12),
    borderRadius: sp(99),
    marginTop: hp(24),
  },
  createListingButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.08,
    lineHeight: fp(20),
  },
  // Populated State Styles
  populatedContainer: {
    paddingHorizontal: wp(16),
    gap: hp(16),
  },
  statsRow: {
    flexDirection: 'row',
    gap: wp(10),
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.05)',
    borderRadius: sp(12),
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    gap: hp(4),
  },
  statValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#212121',
    lineHeight: fp(22),
  },
  statLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    fontWeight: '500',
    color: '#212121',
    opacity: 0.4,
    lineHeight: fp(20),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(99),
    paddingHorizontal: wp(16),
    height: hp(44),
    gap: wp(8),
  },
  searchInput: {
    flex: 1,
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    fontWeight: '500',
    color: '#212121',
    lineHeight: fp(20),
  },
  watchGrid: {
    marginTop: hp(8),
  },
  watchGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  watchCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.05)',
    overflow: 'hidden',
    marginBottom: hp(4),
  },
  watchImageContainer: {
    height: hp(140),
    borderTopLeftRadius: sp(12),
    borderTopRightRadius: sp(12),
    overflow: 'hidden',
    position: 'relative',
  },
  watchImageGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldBadge: {
    position: 'absolute',
    top: hp(8),
    left: wp(8),
    backgroundColor: '#4AA078',
    paddingHorizontal: wp(10),
    paddingVertical: hp(4),
    borderRadius: sp(99),
  },
  soldBadgeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: fp(14),
  },
  watchImage: {
    width: '66%',
    height: '86%',
  },
  watchInfo: {
    paddingHorizontal: wp(16),
    paddingTop: hp(12),
    paddingBottom: hp(16),
    gap: hp(12),
    height: hp(150),
    justifyContent: 'space-between',
  },
  watchDetails: {
    gap: hp(8),
  },
  watchNameContainer: {
    gap: 0,
    height: hp(34),
  },
  watchBrand: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(13),
    fontWeight: '600',
    color: '#212121',
    lineHeight: fp(17),
  },
  watchReference: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(13),
    fontWeight: '500',
    color: '#212121',
    opacity: 0.5,
    lineHeight: fp(17),
  },
  watchPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceContainer: {
    gap: 0,
  },
  soldOrderLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    fontWeight: '500',
    color: 'rgba(33, 33, 33, 0.6)',
    lineHeight: fp(16),
  },
  soldOrderPrice: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#212121',
    lineHeight: fp(20),
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(7),
    paddingVertical: hp(3),
    borderRadius: sp(99),
    gap: wp(4),
  },
  changeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
    lineHeight: fp(14),
  },
  sellButtonContainer: {
    alignItems: 'center',
  },
  sellNowButton: {
    backgroundColor: '#212121',
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    borderRadius: sp(99),
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  sellNowButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: fp(14),
  },
  noBuyOrdersButton: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    borderRadius: sp(99),
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: wp(6),
  },
  noBuyOrdersText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
    color: 'rgba(33, 33, 33, 0.5)',
    lineHeight: fp(14),
  },
  // No Results Styles
  noResultsContainer: {
    paddingVertical: hp(40),
    alignItems: 'center',
  },
  noResultsText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: 'rgba(33, 33, 33, 0.5)',
    textAlign: 'center',
  },
});
