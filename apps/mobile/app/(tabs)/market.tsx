import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Keyboard, ActivityIndicator, RefreshControl, Image, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useFilters } from '@/contexts/FilterContext';
import { registerGuideMeasurement, useGuide } from '@/contexts/GuideContext';
import { useV2 } from '@/contexts/V2Context';
import { GUIDE_MOCK_MARKET_WATCHES, GUIDE_MOCK_TRENDING_WATCHES } from '@/data/guideMockData';
import { api } from '@/services/api';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';
import { Magnifier, UserCircleFilled, TriangleUp, TriangleDown, TrendingUp, PriceAlertDown, Filter, User, Grid } from '@/components/icons';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';
import Svg, { Path, Line } from 'react-native-svg';
import { globalSearchQuery, clearGlobalSearchQuery } from '@/utils/searchState';

// Default category tab (before brands are loaded)
const DEFAULT_CATEGORY = { value: 'All', label: 'All' };

interface WatchMarketData {
  id: string;
  brand: string;
  model: string;
  reference: string;
  ws_code?: string;
  price: number;
  currency: string;
  priceChange: number;
  priceHistory: number[];
  trending?: boolean;
  orderCount?: number;
  lowestOrderPrice?: number;
  adminPrice?: number;
  coverImage?: string;
  wtsCount?: number;
  wtbCount?: number;
  collection?: string;
  oem_references?: string[];
  aliases?: string[];
}

// Mini sparkline component for price chart
function MiniSparkline({ data, width = 40, height = 16, isPositive = true }: { data: number[], width?: number, height?: number, isPositive?: boolean }) {
  // Always render empty view to maintain consistent layout
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pathData = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Use green for positive, red for negative price change
  const color = isPositive ? '#4AA078' : '#D90429';

  // Middle horizontal line position
  const middleY = height / 2;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Horizontal dashed baseline */}
      <Line
        x1={0}
        y1={middleY}
        x2={width}
        y2={middleY}
        stroke="#A8C5DA"
        strokeWidth={1}
        strokeDasharray="2,2"
      />
      {/* Price line */}
      <Path
        d={pathData}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}

// List view icon for view mode toggle
function ListIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 12H21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 18H21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 6H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 12H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 18H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

export default function MarketScreen() {
  const { colors, fonts } = useTheme();
  const { t } = useTranslation();
  const { filters, getTotalFilterCount, hasActiveFilters } = useFilters();
  const { isGuideActive } = useGuide();
  const { v2Enabled } = useV2();
  const filtersButtonRef = useRef<View>(null);
  const firstWatchRowRef = useRef<View>(null);
  const { search: searchParam } = useLocalSearchParams<{ search?: string }>();
  const totalFilterCount = getTotalFilterCount();
  const PAGE_SIZE = 20;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [brandTabs, setBrandTabs] = useState<{ value: string; label: string }[]>([DEFAULT_CATEGORY]);
  const [watches, setWatches] = useState<WatchMarketData[]>([]);
  const [allWatches, setAllWatches] = useState<WatchMarketData[]>([]); // Unfiltered watches
  const [trendingWatches, setTrendingWatches] = useState<WatchMarketData[]>([]);
  const [featuredWatches, setFeaturedWatches] = useState<WatchMarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pick up search query from search screen navigation param
  useEffect(() => {
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParam]);

  // Keep ref in sync so loadMarketData always reads current value
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    router.setParams({ search: '' });
  }, []);

  // Apply filters to watches whenever filters or data change
  useEffect(() => {
    if (allWatches.length > 0) {
      setWatches(applyFiltersToWatches(allWatches));
    }
  }, [filters, allWatches]);

  // Debounced server-side search: reload data when search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMarketData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter function to apply active filters to watch list
  const applyFiltersToWatches = (watchList: WatchMarketData[]) => {
    if (!hasActiveFilters()) return watchList;

    return watchList.filter(watch => {
      // Filter by brand
      if (filters.brands.length > 0) {
        const watchBrand = watch.brand?.toLowerCase();
        const filterBrands = filters.brands.map(b => b.toLowerCase());
        if (!filterBrands.some(b => watchBrand?.includes(b))) {
          return false;
        }
      }

      // Filter by model
      if (filters.models.length > 0) {
        const watchModel = watch.model?.toLowerCase();
        const filterModels = filters.models.map(m => m.toLowerCase());
        if (!filterModels.some(m => watchModel?.includes(m))) {
          return false;
        }
      }

      // Filter by price range
      if (filters.priceMin !== null && watch.price < filters.priceMin) {
        return false;
      }
      if (filters.priceMax !== null && watch.price > filters.priceMax) {
        return false;
      }

      // Filter by reference
      if (filters.references.length > 0) {
        const watchRef = watch.reference?.toLowerCase();
        const filterRefs = filters.references.map(r => r.toLowerCase());
        if (!filterRefs.some(r => watchRef?.includes(r))) {
          return false;
        }
      }

      return true;
    });
  };

  // Load brand tabs on mount
  useEffect(() => {
    const loadBrands = async () => {
      if (isGuideActive) return;
      try {
        const response = await api.get('/market/brands');
        if (response.data && response.data.length > 0) {
          // Deduplicate brands (case-insensitive)
          const seen = new Set<string>();
          const uniqueBrands = (response.data as string[]).filter((b) => {
            const key = b.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const tabs = [DEFAULT_CATEGORY, ...uniqueBrands.map((b) => ({ value: b, label: b }))];
          setBrandTabs(tabs);
        }
      } catch (error) {
        console.error('Failed to load brands:', error);
      }
    };
    loadBrands();
  }, []);

  // Refresh data when screen comes into focus (also fires on initial mount)
  useFocusEffect(
    useCallback(() => {
      if (globalSearchQuery) {
        setSearchQuery(globalSearchQuery);
        clearGlobalSearchQuery();
      }
      loadMarketData();
      loadProfile();
    }, [selectedCategory])
  );

  const loadProfile = async () => {
    if (isGuideActive) return;
    try {
      const response = await api.get('/profile/me');
      if (response.data?.profile_image_url) {
        setProfileImageUrl(response.data.profile_image_url);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const mapAggregatedItem = (item: any): WatchMarketData => ({
    id: item.id || item.reference,
    brand: item.brand,
    model: item.model,
    reference: item.reference || '',
    ws_code: item.ws_code,
    price: item.display_price || 0,
    currency: item.currency || 'EUR',
    priceChange: item.price_change || 0,
    priceHistory: item.price_history || [],
    trending: item.trending || false,
    orderCount: item.total_orders || 0,
    lowestOrderPrice: item.lowest_order_price,
    adminPrice: item.admin_price,
    coverImage: item.cover_image || undefined,
    wtsCount: item.wts_count || 0,
    wtbCount: item.wtb_count || 0,
    collection: item.collection || undefined,
    oem_references: item.oem_references || [],
    aliases: item.aliases || [],
  });

  const loadMarketData = async () => {
    if (isGuideActive) {
      setAllWatches(GUIDE_MOCK_MARKET_WATCHES);
      setWatches(GUIDE_MOCK_MARKET_WATCHES);
      setTrendingWatches(GUIDE_MOCK_TRENDING_WATCHES);
      setFeaturedWatches([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setHasMore(true);
    try {
      const currentSearch = searchQueryRef.current;
      const params: any = { limit: PAGE_SIZE, skip: 0 };
      if (selectedCategory !== 'All') {
        params.brand = selectedCategory;
      }
      if (currentSearch.trim()) {
        params.search = currentSearch.trim();
      }
      const response = await api.get('/market/aggregated', { params });

      if (response.data && response.data.length > 0) {
        const watchData = response.data.map(mapAggregatedItem);
        setAllWatches(watchData);
        setWatches(applyFiltersToWatches(watchData));
        setHasMore(response.data.length >= PAGE_SIZE);

        const hasTrending = await loadTrendingWatches();
        if (!hasTrending) {
          await loadFeaturedWatches();
        } else {
          setFeaturedWatches([]);
        }
      } else {
        setAllWatches([]);
        setWatches([]);
        setHasMore(false);
        const hasTrending = await loadTrendingWatches();
        if (!hasTrending) {
          await loadFeaturedWatches();
        }
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
      setAllWatches([]);
      setWatches([]);
      setHasMore(false);
      const hasTrending = await loadTrendingWatches();
      if (!hasTrending) {
        await loadFeaturedWatches();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMoreWatches = async () => {
    if (loadingMore || !hasMore || isGuideActive) return;
    setLoadingMore(true);
    try {
      const currentSearch = searchQueryRef.current;
      const params: any = { limit: PAGE_SIZE, skip: allWatches.length };
      if (selectedCategory !== 'All') {
        params.brand = selectedCategory;
      }
      if (currentSearch.trim()) {
        params.search = currentSearch.trim();
      }
      const response = await api.get('/market/aggregated', { params });

      if (response.data && response.data.length > 0) {
        const newWatchData = response.data.map(mapAggregatedItem);
        const combined = [...allWatches, ...newWatchData];
        setAllWatches(combined);
        setWatches(applyFiltersToWatches(combined));
        setHasMore(response.data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more watches:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadTrendingWatches = async () => {
    try {
      // Fetch trending watches from the dedicated trending endpoint
      // Priority: admin-assigned trending → order_count → views
      const response = await api.get('/market/trending', {
        params: { limit: 5 }
      });

      if (response.data && response.data.length > 0) {
        const trending = response.data.map((item: any) => ({
          id: item.id || item.reference,
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          ws_code: item.ws_code,
          price: item.price || 0,
          currency: item.currency || 'EUR',
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || [],
          trending: item.trending || true,
          orderCount: item.order_count || 0,
          coverImage: item.cover_image || undefined,
        }));
        setTrendingWatches(trending);
        return trending.length > 0;
      } else {
        setTrendingWatches([]);
        return false;
      }
    } catch (error) {
      console.error('Failed to load trending watches:', error);
      setTrendingWatches([]);
      return false;
    }
  };

  const loadFeaturedWatches = async () => {
    try {
      // Fetch featured watches from the dedicated featured endpoint
      // Priority: admin-assigned featured → order_count → views
      const response = await api.get('/market/featured', {
        params: { limit: 5 }
      });

      if (response.data && response.data.length > 0) {
        const featured = response.data.map((item: any) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          ws_code: item.ws_code,
          price: item.price || 0,
          currency: item.currency || 'EUR',
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || [],
          trending: item.trending || false,
          orderCount: item.order_count || 0,
          coverImage: item.cover_image || undefined,
        }));
        setFeaturedWatches(featured);
      } else {
        setFeaturedWatches([]);
      }
    } catch (error) {
      console.error('Failed to load featured watches:', error);
      setFeaturedWatches([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Load market data which will also load trending/featured watches
    await loadMarketData();
    setRefreshing(false);
  }, [selectedCategory]);

  const handleWatchPress = (watch: WatchMarketData) => {
    const encodedId = encodeURIComponent(watch.id);
    router.push({
      pathname: `/market/${encodedId}`,
      params: {
        reference: watch.reference,
        brand: watch.brand,
        model: watch.model,
        ws_code: watch.ws_code || '',
      },
    } as any);
  };

  const formatPrice = (price: number, currency?: string) => {
    if (!currency || currency === 'EUR') return `€${price.toLocaleString()}`;
    return `${currency} ${price.toLocaleString()}`;
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
      paddingTop: hp(12),
      paddingBottom: 0,
      gap: wp(16),
    },
    logoContainer: {
      width: sp(33),
      height: sp(28),
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBar: {
      flex: 1,
      height: sp(44),
      backgroundColor: '#F6F7F9',
      borderRadius: sp(99),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
    },
    searchIcon: {
      marginRight: wp(8),
      opacity: 0.4,
    },
    searchPlaceholder: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
    },
    searchText: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
      flex: 1,
    },
    searchClearButton: {
      padding: sp(4),
      marginLeft: wp(4),
    },
    profileButton: {
      width: sp(44),
      height: sp(44),
      backgroundColor: '#F6F7F9',
      borderRadius: sp(22),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    profileImage: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
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
      gap: wp(12),
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
      flexShrink: 0,
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
    // Category tabs row with view mode toggle
    categoryTabsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: wp(16),
      marginBottom: hp(16),
    },
    viewModeToggle: {
      width: sp(40),
      height: sp(40),
      justifyContent: 'center',
      alignItems: 'center',
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
      maxWidth: '55%',
      marginRight: wp(8),
    },
    watchName: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    watchModel: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(18),
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
      width: wp(90),
    },
    watchPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    watchPriceFrom: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
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
    // Grid view styles
    gridRow: {
      gap: wp(12),
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(12),
    },
    gridCard: {
      width: GRID_CARD_WIDTH,
      backgroundColor: '#FFFFFF',
      borderRadius: sp(16),
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.05)',
      overflow: 'hidden',
    },
    gridImageContainer: {
      width: '100%',
      height: hp(140),
      backgroundColor: '#F6F7F9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    gridImage: {
      width: '80%',
      height: '80%',
    },
    gridCardContent: {
      padding: wp(12),
      paddingTop: hp(10),
      gap: hp(4),
    },
    gridBrand: {
      fontSize: fp(13),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(17),
    },
    gridModel: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(17),
    },
    gridPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: hp(4),
    },
    gridPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(20),
    },
    gridPriceFrom: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
    },
    gridReference: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      lineHeight: fp(17),
    },
    gridChangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(3),
      paddingHorizontal: wp(6),
      paddingVertical: hp(2),
      borderRadius: sp(99),
    },
    gridChangeBadgeUp: {
      backgroundColor: 'rgba(74, 160, 120, 0.05)',
    },
    gridChangeBadgeDown: {
      backgroundColor: 'rgba(201, 57, 39, 0.05)',
    },
    gridChangeText: {
      fontSize: fp(11),
      fontFamily: fonts.semiBold,
      lineHeight: fp(14),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: hp(100),
    },
  });

  // Header component to pass to SubscriptionOverlay
  const headerComponent = (
    <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <LogoIcon width={33} height={28} color="#212121" />
        </View>
        <View style={styles.searchBar}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/search', params: { initialQuery: searchQuery || '' } })}
          >
            <View style={styles.searchIcon}>
              <Magnifier size={18} color="#212121" />
            </View>
            <Text style={searchQuery ? styles.searchText : styles.searchPlaceholder} numberOfLines={1}>
              {searchQuery || t('home.searchPlaceholder')}
            </Text>
          </TouchableOpacity>
          {searchQuery ? (
            <TouchableOpacity
              style={styles.searchClearButton}
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="rgba(33, 33, 33, 0.5)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );

  // Render a single list-mode watch item
  const renderListItem = useCallback(({ item: watch, index }: { item: WatchMarketData; index: number }) => {
    const isPositive = watch.priceChange >= 0;
    return (
      <TouchableOpacity
        key={`${watch.id}-list-${index}`}
        ref={index === 0 ? firstWatchRowRef : undefined}
        style={styles.watchItem}
        onPress={() => handleWatchPress(watch)}
        activeOpacity={0.7}
        onLayout={index === 0 ? () => {
          firstWatchRowRef.current?.measureInWindow((x, y, width, height) => {
            if (width > 0 && height > 0) {
              registerGuideMeasurement('watch-details', { x, y, width, height, borderRadius: 8 });
            }
          });
        } : undefined}
      >
        <View style={styles.watchInfo}>
          <Text style={styles.watchName} numberOfLines={1}>{watch.brand}</Text>
          <Text style={styles.watchModel} numberOfLines={1}>{watch.model}</Text>
          <Text style={styles.watchReference} numberOfLines={1}>{watch.ws_code || watch.reference}</Text>
        </View>
        <View style={styles.watchPriceSection}>
          {v2Enabled ? (
            <>
              <View style={styles.chartContainer}>
                <MiniSparkline
                  data={watch.priceHistory}
                  width={40}
                  height={16}
                  isPositive={isPositive}
                />
              </View>
              <View style={styles.watchPriceInfo}>
                <View style={styles.watchChange}>
                  {isPositive ? (
                    <TrendingUp size={12} color="#4AA078" />
                  ) : (
                    <PriceAlertDown size={12} color="#C93927" />
                  )}
                  <Text style={[
                    styles.watchChangeText,
                    isPositive ? styles.watchChangePositive : styles.watchChangeNegative
                  ]}>
                    {Math.abs(watch.priceChange).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(6) }}>
              <View style={{ backgroundColor: 'rgba(74,160,120,0.1)', paddingHorizontal: wp(8), paddingVertical: hp(3), borderRadius: sp(99) }}>
                <Text style={{ fontFamily: fonts.semiBold, fontSize: fp(11), color: '#4AA078' }}>WTS {watch.wtsCount || 0}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(91,155,213,0.1)', paddingHorizontal: wp(8), paddingVertical: hp(3), borderRadius: sp(99) }}>
                <Text style={{ fontFamily: fonts.semiBold, fontSize: fp(11), color: '#5B9BD5' }}>WTB {watch.wtbCount || 0}</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [v2Enabled, fonts]);

  // Render a single grid-mode watch item
  const renderGridItem = useCallback(({ item: watch, index }: { item: WatchMarketData; index: number }) => {
    const isPositive = watch.priceChange >= 0;
    return (
      <TouchableOpacity
        key={`${watch.id}-grid-${index}`}
        ref={index === 0 ? firstWatchRowRef : undefined}
        style={styles.gridCard}
        onPress={() => handleWatchPress(watch)}
        activeOpacity={0.7}
        onLayout={index === 0 ? () => {
          firstWatchRowRef.current?.measureInWindow((x, y, width, height) => {
            if (width > 0 && height > 0) {
              registerGuideMeasurement('watch-details', { x, y, width, height, borderRadius: 8 });
            }
          });
        } : undefined}
      >
        <View style={styles.gridImageContainer}>
          {watch.coverImage ? (
            <Image source={{ uri: watch.coverImage, cache: 'force-cache' }} style={styles.gridImage} resizeMode="contain" />
          ) : (
            <LogoIcon size={sp(40)} color="rgba(33, 33, 33, 0.12)" />
          )}
        </View>
        <View style={styles.gridCardContent}>
          <Text style={styles.gridBrand} numberOfLines={1}>{watch.brand}</Text>
          <Text style={styles.gridModel} numberOfLines={1}>{watch.model}</Text>
          <Text style={styles.gridReference} numberOfLines={1}>{watch.ws_code || watch.reference}</Text>
          <View style={[styles.gridPriceRow]}>
            {v2Enabled ? (
              <View style={[
                styles.gridChangeBadge,
                isPositive ? styles.gridChangeBadgeUp : styles.gridChangeBadgeDown,
              ]}>
                {isPositive ? (
                  <TrendingUp size={10} color="#4AA078" />
                ) : (
                  <PriceAlertDown size={10} color="#C93927" />
                )}
                <Text style={[
                  styles.gridChangeText,
                  isPositive ? styles.watchChangePositive : styles.watchChangeNegative
                ]}>
                  {Math.abs(watch.priceChange).toFixed(1)}%
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(4) }}>
                <View style={{ backgroundColor: 'rgba(74,160,120,0.1)', paddingHorizontal: wp(6), paddingVertical: hp(2), borderRadius: sp(99) }}>
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: fp(10), color: '#4AA078' }}>WTS {watch.wtsCount || 0}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(91,155,213,0.1)', paddingHorizontal: wp(6), paddingVertical: hp(2), borderRadius: sp(99) }}>
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: fp(10), color: '#5B9BD5' }}>WTB {watch.wtbCount || 0}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [v2Enabled, fonts]);

  // FlatList header component containing trending, section title, and category tabs
  const ListHeaderContent = useCallback(() => (
    <>
      {/* Trending / Featured Watches Section */}
      {v2Enabled && <View style={styles.trendingSection}>
        <Text style={styles.sectionTitle}>
          {trendingWatches.length > 0 ? t('market.trendingWatches') : t('market.featuredWatches')}
        </Text>
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
                      <Text style={styles.trendingName} numberOfLines={1} ellipsizeMode="tail">{watch.brand}</Text>
                      <Text style={styles.trendingPrice}>{formatPrice(watch.price, watch.currency)}</Text>
                    </View>
                    <View style={styles.trendingBottomRow}>
                      <Text style={styles.trendingReference}>{watch.ws_code || watch.reference}</Text>
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
                      <Text style={styles.trendingName} numberOfLines={1} ellipsizeMode="tail">{watch.brand}</Text>
                      <Text style={styles.trendingPrice}>{formatPrice(watch.price, watch.currency)}</Text>
                    </View>
                    <View style={styles.trendingBottomRow}>
                      <Text style={styles.trendingReference}>{watch.ws_code || watch.reference}</Text>
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
          <View style={styles.trendingEmptyContainer}>
            <Text style={styles.emptyText}>{t('market.noWatchesAvailable')}</Text>
          </View>
        )}
      </View>}

      {/* Watches Section Header */}
      <View style={[styles.watchesHeader, !v2Enabled && { paddingTop: hp(16) }]}>
        <Text style={styles.watchesTitle}>{t('market.watches')}</Text>
      </View>

      {/* Category Tabs with View Mode Toggle */}
      <View style={styles.categoryTabsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
          style={{ flex: 1 }}
        >
          {brandTabs.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.categoryTab,
                selectedCategory === tab.value && styles.categoryTabActive
              ]}
              onPress={() => setSelectedCategory(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === tab.value && styles.categoryTabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.viewModeToggle}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          activeOpacity={0.7}
        >
          {viewMode === 'grid' ? (
            <ListIcon size={20} color="#212121" />
          ) : (
            <Grid size={20} color="#212121" />
          )}
        </TouchableOpacity>
      </View>
    </>
  ), [v2Enabled, trendingWatches, featuredWatches, brandTabs, selectedCategory, viewMode, loading, t]);

  const keyExtractor = useCallback((item: WatchMarketData, index: number) => `${item.id}-${viewMode}-${index}`, [viewMode]);

  return (
    <SubscriptionOverlay feature="market" header={headerComponent}>
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={watches}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={ListHeaderContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('market.noWatchesFound')}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: hp(20), alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#212121" />
            </View>
          ) : null}
          onEndReached={() => {
            if (!loadingMore && hasMore && !loading) {
              loadMoreWatches();
            }
          }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          contentContainerStyle={styles.scrollContent}
        />
      ) : (
        <FlatList
          data={watches}
          renderItem={renderListItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeaderContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('market.noWatchesFound')}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: hp(20), alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#212121" />
            </View>
          ) : null}
          onEndReached={() => {
            if (!loadingMore && hasMore && !loading) {
              loadMoreWatches();
            }
          }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          contentContainerStyle={styles.scrollContent}
        />
      )}
    </View>
    </SubscriptionOverlay>
  );
}
