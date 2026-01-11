import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { User } from '@/components/icons';
import {
  Magnifier,
  UserCircleFilled,
  TagPlus,
  PriceAlertDown,
  TrendingUp,
  ChevronRight,
  ActivityChart,
  SparkleIcon,
  WatchIcon,
  FileCheckIcon,
  SocialSearchIcon,
  GridIcon,
  AISparkle,
  Heart,
  Newspaper,
} from '@/components/icons';
import { LogoIcon } from '@/components/LogoIcon';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';

const CARD_GAP = wp(12);
const HORIZONTAL_PADDING = wp(16);
const CARD_WIDTH = (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;

interface WatchlistItem {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  image?: string;
}

interface ActivityItem {
  id: string;
  type: 'new_offer' | 'price_alert';
  reference: string;
  price: number;
  time: string;
}

interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  icon: 'activity' | 'sparkle' | 'watch' | 'file' | 'social' | 'grid';
  color: string;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  imageUrl?: string;
}

export default function HomeScreen() {
  const { colors, fonts } = useTheme();

  // State for API data
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // Quick Access items (static - these are navigation items)
  const quickAccessItems: QuickAccessItem[] = [
    {
      id: '1',
      title: 'Activity Center',
      subtitle: 'Track your matches, payments, shipping',
      icon: 'activity',
      color: '#FF7373',
    },
    {
      id: '2',
      title: 'Ask AI Assistant',
      subtitle: 'Your personal assistant, 24/7.',
      icon: 'sparkle',
      color: '#D573FF',
    },
    {
      id: '3',
      title: 'My Inventory',
      subtitle: 'Manage, edit and track your full watch stock.',
      icon: 'watch',
      color: '#767676',
    },
    {
      id: '4',
      title: 'My Orders',
      subtitle: 'View and manage all your active buy orders.',
      icon: 'file',
      color: '#32D287',
    },
    {
      id: '5',
      title: 'Social search',
      subtitle: 'Look up watches from different social channels.',
      icon: 'social',
      color: '#7C73FF',
    },
    {
      id: '6',
      title: 'All Tools',
      subtitle: 'Everything else you need, in one place.',
      icon: 'grid',
      color: '#73BEFF',
    },
  ];

  // Load data on initial mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    await Promise.all([loadWatchlist(), loadActivity(), loadNews(), loadProfile()]);
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      if (response.data?.profile_image_url) {
        setProfileImageUrl(response.data.profile_image_url);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/profile/watchlist');
      if (response.data && response.data.length > 0) {
        setWatchlistItems(response.data.slice(0, 4).map((item: any) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          price: item.price || item.target_price || 0,
          priceChange: item.priceChange || 0,
          image: item.image,
        })));
      } else {
        // User watchlist is empty, try to fetch default watchlist
        try {
          const defaultResponse = await api.get('/default-watchlist/admin/default-watchlist');
          if (defaultResponse.data && defaultResponse.data.length > 0) {
            // Filter only active items and map to watchlist format
            const activeItems = defaultResponse.data.filter((item: any) => item.is_active);
            setWatchlistItems(activeItems.slice(0, 4).map((item: any) => ({
              id: item.id,
              brand: item.brand,
              model: item.model,
              reference: item.reference || '',
              price: item.target_price || 0,
              priceChange: 0,
              image: null,
            })));
          } else {
            setWatchlistItems([]);
          }
        } catch (defaultError) {
          // Default watchlist also not available
          setWatchlistItems([]);
        }
      }
    } catch (error) {
      // Silently handle errors - show empty state instead
      setWatchlistItems([]);
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const loadActivity = async () => {
    try {
      const response = await api.get('/activity/admin/activity?limit=3');
      if (response.data && response.data.length > 0) {
        setActivityItems(response.data.map((item: any) => ({
          id: item.id,
          type: item.activity_type === 'price_alert' ? 'price_alert' : 'new_offer',
          reference: item.metadata?.reference || item.entity_id || '',
          price: item.metadata?.price || 0,
          time: formatTimeAgo(item.created_at),
        })));
      } else {
        setActivityItems([]);
      }
    } catch (error) {
      // Silently handle errors - show empty state instead
      setActivityItems([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadNews = async () => {
    try {
      const response = await api.get('/news?limit=3');
      if (response.data && response.data.length > 0) {
        setNewsItems(response.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          source: item.author_name || 'WatchSphere',
          time: formatTimeAgo(item.published_at || item.created_at),
          imageUrl: item.cover_image,
        })));
      } else {
        setNewsItems([]);
      }
    } catch (error) {
      // Silently handle errors - show empty state instead
      setNewsItems([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString()}`;
  };

  const renderQuickAccessIcon = (icon: string, color: string) => {
    switch (icon) {
      case 'activity':
        return <ActivityChart size={18} color="#FFFFFF" />;
      case 'sparkle':
        return <SparkleIcon size={16} color="#FFFFFF" />;
      case 'watch':
        return <WatchIcon size={16} color="#FFFFFF" />;
      case 'file':
        return <FileCheckIcon size={16} color="#FFFFFF" />;
      case 'social':
        return <SocialSearchIcon size={16} color="#FFFFFF" />;
      case 'grid':
        return <GridIcon size={16} color="#FFFFFF" />;
      default:
        return <GridIcon size={16} color="#FFFFFF" />;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: hp(100),
    },
    // Header styles
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: 0,
      marginBottom: hp(32),
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
    // Section header styles
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      marginBottom: hp(16),
    },
    sectionTitle: {
      fontSize: fp(24),
      fontFamily: fonts.bold,
      color: '#212121',
      letterSpacing: 0.12,
    },
    viewAllButton: {
      borderBottomWidth: 1,
      borderBottomColor: '#212121',
      paddingVertical: hp(2),
    },
    viewAllText: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
    },
    // Loading and empty state styles
    loadingContainer: {
      paddingVertical: hp(32),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp(32),
      paddingHorizontal: wp(24),
    },
    emptyIconContainer: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(32),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    emptyTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      marginBottom: hp(8),
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      lineHeight: fp(20),
    },
    // Activity section styles
    activitySection: {
      marginBottom: hp(16),
    },
    activityEmptyState: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
      gap: hp(8),
    },
    activityEmptyIconContainer: {
      width: sp(48),
      height: sp(48),
      borderRadius: sp(24),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    activityEmptyText: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
      textAlign: 'center',
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(10),
      gap: wp(12),
    },
    activityIconContainer: {
      width: sp(40),
      height: sp(40),
      borderRadius: sp(540),
      justifyContent: 'center',
      alignItems: 'center',
    },
    activityIconBlue: {
      backgroundColor: 'rgba(0, 136, 255, 0.05)',
    },
    activityIconRed: {
      backgroundColor: 'rgba(217, 4, 41, 0.05)',
    },
    activityContent: {
      flex: 1,
      gap: hp(2),
    },
    activityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    activityText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
    },
    activityReference: {
      fontFamily: fonts.semiBold,
    },
    activityPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
    },
    activityTime: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      color: '#747474',
      letterSpacing: 0.06,
    },
    // Watchlist section styles
    watchlistSection: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(32),
    },
    watchlistGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(12),
    },
    watchCard: {
      width: CARD_WIDTH,
      backgroundColor: '#FFFFFF',
      borderRadius: sp(16),
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.05)',
      overflow: 'hidden',
    },
    watchImageContainer: {
      width: '100%',
      height: hp(140),
      borderTopLeftRadius: sp(12),
      borderTopRightRadius: sp(12),
      overflow: 'hidden',
    },
    watchImageGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    watchImage: {
      width: '66%',
      height: '85%',
      resizeMode: 'contain',
    },
    watchCardContent: {
      padding: wp(16),
      paddingTop: hp(12),
      gap: hp(12),
    },
    watchName: {
      fontSize: fp(13),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(17),
    },
    watchReference: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      lineHeight: fp(17),
    },
    watchPriceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    watchPrice: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(20),
    },
    watchChangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
      paddingHorizontal: wp(7),
      paddingVertical: hp(3),
      borderRadius: sp(99),
    },
    watchChangeBadgeUp: {
      backgroundColor: 'rgba(74, 160, 120, 0.05)',
    },
    watchChangeBadgeDown: {
      backgroundColor: 'rgba(201, 57, 39, 0.05)',
    },
    watchChangeText: {
      fontSize: fp(11),
      fontFamily: fonts.semiBold,
      lineHeight: fp(14),
    },
    watchChangeTextUp: {
      color: '#4AA078',
    },
    watchChangeTextDown: {
      color: '#C93927',
    },
    // Quick Access section styles
    quickAccessSection: {
      paddingHorizontal: wp(20),
      paddingVertical: hp(32),
      paddingTop: 0,
    },
    quickAccessList: {
      backgroundColor: '#FFFFFF',
      borderRadius: sp(16),
      paddingVertical: hp(16),
      gap: hp(16),
    },
    quickAccessItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: wp(16),
    },
    quickAccessIconContainer: {
      width: sp(36),
      height: sp(36),
      borderRadius: sp(8),
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickAccessContent: {
      flex: 1,
      gap: hp(12),
    },
    quickAccessTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    quickAccessTextContent: {
      flex: 1,
    },
    quickAccessTitle: {
      fontSize: fp(14),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.07,
      lineHeight: fp(19),
    },
    quickAccessSubtitle: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: '#787789',
      lineHeight: fp(19),
    },
    quickAccessChevron: {
      opacity: 0.4,
    },
    quickAccessDivider: {
      height: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    // News section styles
    newsSection: {
      paddingHorizontal: wp(20),
      paddingBottom: hp(32),
    },
    newsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(12),
      paddingVertical: hp(16),
    },
    newsImage: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(16),
      backgroundColor: '#E6E6E6',
    },
    newsImagePlaceholder: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(16),
      backgroundColor: '#F6F7F9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    newsContent: {
      flex: 1,
      gap: hp(4),
    },
    newsTitle: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(19),
    },
    newsSourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    newsSource: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#787789',
      letterSpacing: -0.13,
    },
    newsTime: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#787789',
      letterSpacing: -0.13,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
        }
      >
        {/* Header with Logo, Search Bar, and Profile */}
        <View style={styles.header}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <LogoIcon width={33} height={28} color="#212121" />
          </View>

          {/* Search Bar */}
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/search')}>
            <View style={styles.searchIcon}>
              <Magnifier size={18} color="#212121" />
            </View>
            <Text style={styles.searchPlaceholder}>Search watches...</Text>
          </TouchableOpacity>

          {/* Profile Button */}
          <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
            ) : (
              <User size={24} color="#212121" />
            )}
          </TouchableOpacity>
        </View>

        {/* Latest Activity Section */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest activity</Text>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/(tabs)/notifications' as any)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#212121" />
            </View>
          ) : activityItems.length === 0 ? (
            <View style={styles.activityEmptyState}>
              <View style={styles.activityEmptyIconContainer}>
                <ActivityChart size={20} color="rgba(33, 33, 33, 0.4)" />
              </View>
              <Text style={styles.activityEmptyText}>No recent activity</Text>
            </View>
          ) : (
            activityItems.map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIconContainer,
                    item.type === 'new_offer' ? styles.activityIconBlue : styles.activityIconRed,
                  ]}
                >
                  {item.type === 'new_offer' ? (
                    <TagPlus size={18} color="#0088FF" />
                  ) : (
                    <PriceAlertDown size={20} color="#C93927" />
                  )}
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityRow}>
                    <Text style={styles.activityText}>
                      {item.type === 'new_offer' ? 'New offer ' : 'Price alert triggered '}
                      <Text style={styles.activityReference}>{item.reference}</Text>
                    </Text>
                    <Text style={styles.activityPrice}>{formatPrice(item.price)}</Text>
                  </View>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Watchlist Section */}
        <View style={styles.watchlistSection}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/market')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingWatchlist ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#212121" />
            </View>
          ) : watchlistItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Heart size={28} color="rgba(33, 33, 33, 0.4)" />
              </View>
              <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking watches to monitor their prices and market trends
              </Text>
            </View>
          ) : (
            <View style={styles.watchlistGrid}>
              {watchlistItems.map((watch) => {
                const isPositive = watch.priceChange > 0;
                return (
                  <TouchableOpacity
                    key={watch.id}
                    style={styles.watchCard}
                    onPress={() => router.push({
                      pathname: '/market/[id]',
                      params: {
                        id: watch.id,
                        reference: watch.reference,
                        brand: watch.brand,
                        model: watch.model,
                      },
                    } as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.watchImageContainer}>
                      <LinearGradient
                        colors={['#FFFFFF', '#F4F4F4']}
                        style={styles.watchImageGradient}
                      >
                        {watch.image ? (
                          <Image source={{ uri: watch.image }} style={styles.watchImage} />
                        ) : (
                          <LogoIcon size={sp(48)} color="rgba(33, 33, 33, 0.15)" />
                        )}
                      </LinearGradient>
                    </View>
                    <View style={styles.watchCardContent}>
                      <View>
                        <Text style={styles.watchName} numberOfLines={1}>{watch.brand} {watch.model}</Text>
                        <Text style={styles.watchReference} numberOfLines={1}>{watch.reference}</Text>
                      </View>
                      <View style={styles.watchPriceRow}>
                        <Text style={styles.watchPrice}>{formatPrice(watch.price)}€</Text>
                        <View
                          style={[
                            styles.watchChangeBadge,
                            isPositive ? styles.watchChangeBadgeUp : styles.watchChangeBadgeDown,
                          ]}
                        >
                          {isPositive ? (
                            <TrendingUp size={12} color="#4AA078" />
                          ) : (
                            <PriceAlertDown size={12} color="#C93927" />
                          )}
                          <Text
                            style={[
                              styles.watchChangeText,
                              isPositive ? styles.watchChangeTextUp : styles.watchChangeTextDown,
                            ]}
                          >
                            {Math.abs(watch.priceChange).toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Access Section */}
        <View style={styles.quickAccessSection}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
          </View>

          <View style={styles.quickAccessList}>
            {quickAccessItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={styles.quickAccessItem}
                  onPress={() => {
                    if (item.title === 'Activity Center') {
                      router.push('/(auth)/notifications' as any);
                    } else if (item.title === 'My Inventory') {
                      router.push('/(tabs)/dashboard' as any);
                    } else if (item.title === 'Ask AI Assistant') {
                      router.push('/chat/ai');
                    } else if (item.title === 'My Orders') {
                      router.push({ pathname: '/settings/orders', params: { type: 'buy' } } as any);
                    } else if (item.title === 'Social search') {
                      router.push('/social-search');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickAccessIconContainer, { backgroundColor: item.color }]}>
                    {renderQuickAccessIcon(item.icon, item.color)}
                  </View>
                  <View style={styles.quickAccessContent}>
                    <View style={styles.quickAccessTextRow}>
                      <View style={styles.quickAccessTextContent}>
                        <Text style={styles.quickAccessTitle}>{item.title}</Text>
                        <Text style={styles.quickAccessSubtitle}>{item.subtitle}</Text>
                      </View>
                      <View style={styles.quickAccessChevron}>
                        <ChevronRight size={18} color="#212121" />
                      </View>
                    </View>
                    {index < quickAccessItems.length - 1 && <View style={styles.quickAccessDivider} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Trending News Section */}
        <View style={styles.newsSection}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
            <Text style={styles.sectionTitle}>Trending news</Text>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/news' as any)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingNews ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#212121" />
            </View>
          ) : newsItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Newspaper size={28} color="rgba(33, 33, 33, 0.4)" />
              </View>
              <Text style={styles.emptyTitle}>No news available</Text>
              <Text style={styles.emptySubtitle}>Latest watch news will appear here</Text>
            </View>
          ) : (
            newsItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.newsItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/news/${item.id}`)}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.newsImage}
                  />
                ) : (
                  <View style={styles.newsImagePlaceholder}>
                    <Newspaper size={24} color="rgba(33, 33, 33, 0.3)" />
                  </View>
                )}
                <View style={styles.newsContent}>
                  <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.newsSourceRow}>
                    <Text style={styles.newsSource}>{item.source}</Text>
                    <Text style={styles.newsTime}> · </Text>
                    <Text style={styles.newsTime}>{item.time}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
