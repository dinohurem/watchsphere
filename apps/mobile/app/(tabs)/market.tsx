import { View, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilters } from '@/contexts/FilterContext';
import { api } from '@/services/api';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';
import { Magnifier, UserCircleFilled, TriangleUp, TriangleDown, Filter } from '@/components/icons';
import Svg, { Path } from 'react-native-svg';

// Category tabs
const CATEGORIES = ['Hot', 'Gainers', 'Losers', 'New', 'Trending'];

interface WatchMarketData {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  priceHistory: number[];
  trending?: boolean;
  orderCount?: number;
  lowestOrderPrice?: number;
  adminPrice?: number;
}

// Mini sparkline component for price chart
function MiniSparkline({ data, isPositive, width = 40, height = 16 }: { data: number[], isPositive: boolean, width?: number, height?: number }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pathData = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const color = isPositive ? '#4AA078' : '#D90429';

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path
        d={pathData}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}

export default function MarketScreen() {
  const { colors, fonts } = useTheme();
  const { getTotalFilterCount } = useFilters();
  const totalFilterCount = getTotalFilterCount();
  const [selectedCategory, setSelectedCategory] = useState('Hot');
  const [watches, setWatches] = useState<WatchMarketData[]>([]);
  const [trendingWatches, setTrendingWatches] = useState<WatchMarketData[]>([]);
  const [featuredWatches, setFeaturedWatches] = useState<WatchMarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMarketData();
  }, [selectedCategory]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadMarketData();
    }, [selectedCategory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMarketData();
    setRefreshing(false);
  }, [selectedCategory]);

  const loadMarketData = async () => {
    setLoading(true);
    try {
      // Try to fetch from aggregated API (proper pricing logic)
      const response = await api.get('/market/aggregated', {
        params: {
          category: selectedCategory.toLowerCase(),
          limit: 20
        }
      });

      if (response.data && response.data.length > 0) {
        const watchData = response.data.map((item: any) => ({
          id: item.reference, // Use reference as ID for aggregated data
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          // Use display_price which is lowest order price OR admin price
          price: item.display_price || 0,
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || generatePriceHistory(item.display_price || 0, item.price_change || 0),
          trending: item.trending || false,
          orderCount: item.total_orders || 0,
          lowestOrderPrice: item.lowest_order_price,
          adminPrice: item.admin_price,
        }));

        setWatches(watchData);

        // Get trending watches
        const trending = watchData.filter((w: WatchMarketData) => w.trending).slice(0, 5);
        setTrendingWatches(trending);

        // If no trending watches, fetch featured watches as fallback
        if (trending.length === 0) {
          await loadFeaturedWatches();
        } else {
          setFeaturedWatches([]);
        }
      } else {
        // Fallback to old endpoint
        const fallbackResponse = await api.get('/market/watches', {
          params: {
            category: selectedCategory.toLowerCase(),
            limit: 20
          }
        });

        if (fallbackResponse.data && fallbackResponse.data.length > 0) {
          const watchData = fallbackResponse.data.map((item: any) => ({
            id: item.id,
            brand: item.brand,
            model: item.model,
            reference: item.reference || '',
            price: item.price || 0,
            priceChange: item.price_change || 0,
            priceHistory: item.price_history || generatePriceHistory(item.price || 0, item.price_change || 0),
            trending: item.trending || false,
            orderCount: item.order_count || 0,
          }));

          setWatches(watchData);

          const trending = watchData.filter((w: WatchMarketData) => w.trending).slice(0, 5);
          setTrendingWatches(trending);

          // If no trending, fetch featured
          if (trending.length === 0) {
            await loadFeaturedWatches();
          } else {
            setFeaturedWatches([]);
          }
        } else {
          // No data available - show empty state
          setWatches([]);
          setTrendingWatches([]);
          await loadFeaturedWatches();
        }
      }
    } catch (error) {
      // Error fetching - show empty state
      console.error('Failed to load market data:', error);
      setWatches([]);
      setTrendingWatches([]);
      await loadFeaturedWatches();
    } finally {
      setLoading(false);
    }
  };

  const loadFeaturedWatches = async () => {
    try {
      // Fetch featured watches from the market endpoint
      const response = await api.get('/market', {
        params: { limit: 5 }
      });

      if (response.data && response.data.length > 0) {
        const featured = response.data
          .filter((item: any) => item.featured)
          .slice(0, 5)
          .map((item: any) => ({
            id: item.id,
            brand: item.brand,
            model: item.model,
            reference: item.reference || '',
            price: item.price || 0,
            priceChange: item.price_change || 0,
            priceHistory: generatePriceHistory(item.price || 0, item.price_change || 0),
            trending: false,
            orderCount: 0,
          }));
        setFeaturedWatches(featured);
      }
    } catch (error) {
      console.error('Failed to load featured watches:', error);
      setFeaturedWatches([]);
    }
  };

  // Generate price history for sparkline chart based on current price and change
  const generatePriceHistory = (price: number, change: number) => {
    if (!price) return [];
    const history = [];
    let currentPrice = price / (1 + change / 100);
    for (let i = 0; i < 6; i++) {
      history.push(Math.round(currentPrice));
      currentPrice = currentPrice * (1 + (change / 100) / 5);
    }
    return history;
  };

  const handleWatchPress = (watch: WatchMarketData) => {
    // Navigate with both ID and reference for flexibility
    router.push({
      pathname: `/market/${watch.id}`,
      params: {
        reference: watch.reference,
        brand: watch.brand,
        model: watch.model,
      },
    });
  };

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString()}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    // Header styles
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(10),
      gap: wp(16),
    },
    logoContainer: {
      width: sp(44),
      height: sp(27.25),
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBar: {
      flex: 1,
      height: sp(44),
      backgroundColor: '#FAFAFA',
      borderRadius: sp(99),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
    },
    searchIcon: {
      marginRight: wp(10),
      opacity: 0.4,
    },
    searchPlaceholder: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
    },
    profileButton: {
      width: sp(44),
      height: sp(44),
      backgroundColor: '#FAFAFA',
      borderRadius: sp(296),
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Trending section
    trendingSection: {
      paddingTop: hp(16),
      paddingBottom: hp(32),
    },
    sectionTitle: {
      fontSize: fp(24),
      fontFamily: fonts.bold,
      color: '#212121',
      letterSpacing: 0.12,
      paddingHorizontal: wp(16),
      marginBottom: hp(16),
    },
    trendingScrollContent: {
      paddingHorizontal: wp(16),
      gap: wp(16),
    },
    trendingCard: {
      width: wp(226),
      backgroundColor: '#FAFAFA',
      borderRadius: sp(16),
      padding: wp(16),
    },
    trendingCardContent: {
      paddingVertical: hp(10),
      gap: hp(8),
    },
    trendingTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: wp(8),
    },
    trendingBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    trendingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    trendingName: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    trendingPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      textAlign: 'right',
    },
    trendingReference: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.075,
    },
    trendingChange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    trendingChangeText: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      lineHeight: fp(16),
    },
    trendingChangePositive: {
      color: '#4AA078',
    },
    trendingChangeNegative: {
      color: '#D90429',
    },
    // Watches section header
    watchesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      marginBottom: hp(16),
    },
    watchesTitle: {
      fontSize: fp(24),
      fontFamily: fonts.bold,
      color: '#0F0D2D',
      letterSpacing: 0.12,
    },
    filtersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
      paddingHorizontal: wp(12),
      paddingVertical: hp(8),
      borderWidth: 1,
      borderColor: '#212121',
      borderRadius: sp(999),
    },
    filtersButtonText: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      letterSpacing: 0.075,
    },
    filterBadge: {
      backgroundColor: '#212121',
      borderRadius: sp(10),
      minWidth: sp(20),
      height: sp(20),
      paddingHorizontal: wp(6),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: wp(4),
    },
    filterBadgeText: {
      fontFamily: fonts.medium,
      fontSize: fp(12),
      color: '#FFFFFF',
      letterSpacing: 0.06,
    },
    // Category tabs
    categoryTabs: {
      flexDirection: 'row',
      paddingHorizontal: wp(16),
      gap: wp(8),
      marginBottom: hp(16),
    },
    categoryTab: {
      paddingHorizontal: wp(20),
      paddingVertical: hp(11),
      borderRadius: sp(99),
    },
    categoryTabActive: {
      backgroundColor: '#212121',
    },
    categoryTabText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      letterSpacing: 0.075,
    },
    categoryTabTextActive: {
      fontFamily: fonts.medium,
      color: '#FFFFFF',
    },
    // Watch list
    watchList: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(8),
    },
    watchItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: hp(10),
    },
    watchInfo: {
      flex: 1,
    },
    watchName: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    watchReference: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    watchPriceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(12),
    },
    chartContainer: {
      width: wp(40),
      height: hp(16),
    },
    watchPriceInfo: {
      alignItems: 'flex-end',
    },
    watchPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    watchChange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    watchChangeText: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      lineHeight: fp(16),
    },
    watchChangePositive: {
      color: '#4AA078',
    },
    watchChangeNegative: {
      color: '#D90429',
    },
    // Loading and empty states
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(40),
    },
    emptyContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
      paddingHorizontal: wp(32),
    },
    trendingEmptyContainer: {
      width: SCREEN_WIDTH - wp(32),
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(40),
    },
    emptyText: {
      fontSize: fp(16),
      fontFamily: fonts.medium,
      color: 'rgba(33, 33, 33, 0.5)',
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: hp(100),
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <LogoIcon width={44} height={27.25} color="#212121" />
        </View>
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.7}>
          <View style={styles.searchIcon}>
            <Magnifier size={18} color="#212121" />
          </View>
          <Text style={styles.searchPlaceholder}>Search watches...</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
          <UserCircleFilled size={36} color="#212121" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
        }
      >
        {/* Trending / Featured Watches Section */}
        <View style={styles.trendingSection}>
          <Text style={styles.sectionTitle}>
            {trendingWatches.length > 0 ? 'Trending watches' : 'Featured watches'}
          </Text>
          {/* Show trending watches if available */}
          {trendingWatches.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingScrollContent}
            >
              {trendingWatches.map((watch, index) => {
                const isPositive = watch.priceChange >= 0;
                return (
                  <TouchableOpacity
                    key={`${watch.id}-${index}`}
                    style={styles.trendingCard}
                    onPress={() => handleWatchPress(watch)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trendingCardContent}>
                      <View style={styles.trendingTopRow}>
                        <Text style={styles.trendingName} numberOfLines={2}>{watch.brand} {watch.model}</Text>
                        <Text style={styles.trendingPrice}>{formatPrice(watch.price)}</Text>
                      </View>
                      <View style={styles.trendingBottomRow}>
                        <Text style={styles.trendingReference}>{watch.reference}</Text>
                        <View style={styles.trendingChange}>
                          {isPositive ? (
                            <TriangleUp size={12} color="#4AA078" />
                          ) : (
                            <TriangleDown size={12} color="#D90429" />
                          )}
                          <Text style={[
                            styles.trendingChangeText,
                            isPositive ? styles.trendingChangePositive : styles.trendingChangeNegative
                          ]}>
                            {Math.abs(watch.priceChange).toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : featuredWatches.length > 0 ? (
            /* Show featured watches as fallback */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingScrollContent}
            >
              {featuredWatches.map((watch, index) => {
                const isPositive = watch.priceChange >= 0;
                return (
                  <TouchableOpacity
                    key={`featured-${watch.id}-${index}`}
                    style={styles.trendingCard}
                    onPress={() => handleWatchPress(watch)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trendingCardContent}>
                      <View style={styles.trendingTopRow}>
                        <Text style={styles.trendingName} numberOfLines={2}>{watch.brand} {watch.model}</Text>
                        <Text style={styles.trendingPrice}>{formatPrice(watch.price)}</Text>
                      </View>
                      <View style={styles.trendingBottomRow}>
                        <Text style={styles.trendingReference}>{watch.reference}</Text>
                        <View style={styles.trendingChange}>
                          {isPositive ? (
                            <TriangleUp size={12} color="#4AA078" />
                          ) : (
                            <TriangleDown size={12} color="#D90429" />
                          )}
                          <Text style={[
                            styles.trendingChangeText,
                            isPositive ? styles.trendingChangePositive : styles.trendingChangeNegative
                          ]}>
                            {Math.abs(watch.priceChange).toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : !loading && (
            /* Centered empty state when no trending or featured watches */
            <View style={styles.trendingEmptyContainer}>
              <Text style={styles.emptyText}>No watches available</Text>
            </View>
          )}
        </View>

        {/* Watches Section Header */}
        <View style={styles.watchesHeader}>
          <Text style={styles.watchesTitle}>Watches</Text>
          <TouchableOpacity
            style={styles.filtersButton}
            onPress={() => router.push('/market/filters' as any)}
            activeOpacity={0.7}
          >
            <Filter size={26} color="#212121" />
            <Text style={styles.filtersButtonText}>Filters</Text>
            {totalFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{totalFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === category && styles.categoryTabTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Watch List */}
        <View style={styles.watchList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#212121" />
            </View>
          ) : watches.length > 0 ? (
            watches.map((watch, index) => {
              const isPositive = watch.priceChange >= 0;
              return (
                <TouchableOpacity
                  key={`${watch.id}-list-${index}`}
                  style={styles.watchItem}
                  onPress={() => handleWatchPress(watch)}
                  activeOpacity={0.7}
                >
                  <View style={styles.watchInfo}>
                    <Text style={styles.watchName}>{watch.brand} {watch.model}</Text>
                    <Text style={styles.watchReference}>{watch.reference}</Text>
                  </View>
                  <View style={styles.watchPriceSection}>
                    <View style={styles.chartContainer}>
                      <MiniSparkline
                        data={watch.priceHistory}
                        isPositive={isPositive}
                        width={40}
                        height={16}
                      />
                    </View>
                    <View style={styles.watchPriceInfo}>
                      <Text style={styles.watchPrice}>{formatPrice(watch.price)}</Text>
                      <View style={styles.watchChange}>
                        {isPositive ? (
                          <TriangleUp size={12} color="#4AA078" />
                        ) : (
                          <TriangleDown size={12} color="#D90429" />
                        )}
                        <Text style={[
                          styles.watchChangeText,
                          isPositive ? styles.watchChangePositive : styles.watchChangeNegative
                        ]}>
                          {Math.abs(watch.priceChange).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No watches found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
