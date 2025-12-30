import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
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
  ShieldCheckIcon,
  GridIcon,
  AISparkle,
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
  image: any;
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
  icon: 'activity' | 'sparkle' | 'watch' | 'file' | 'shield' | 'grid';
  color: string;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  imageUrl: string;
}

export default function HomeScreen() {
  const { colors, fonts } = useTheme();

  // Watchlist data matching Figma design
  const watchlistItems: WatchlistItem[] = [
    {
      id: '1',
      brand: 'AP',
      model: 'Royal Oak',
      reference: '26240OR Blue',
      price: 106000,
      priceChange: 0.8,
      image: require('../../assets/images/ap.jpeg'),
    },
    {
      id: '2',
      brand: 'Patek',
      model: 'Nautilus',
      reference: '7118/1200R White',
      price: 168000,
      priceChange: 16.3,
      image: require('../../assets/images/patek.jpeg'),
    },
    {
      id: '3',
      brand: 'Rolex',
      model: 'GMT-Master',
      reference: '126710BLRO Jub',
      price: 20800,
      priceChange: 1.5,
      image: require('../../assets/images/rolex.jpeg'),
    },
    {
      id: '4',
      brand: 'Rolex',
      model: 'Day-Date',
      reference: '228238A Blk',
      price: 55200,
      priceChange: -2.5,
      image: require('../../assets/images/rolex-gold.jpeg'),
    },
  ];

  // Activity items matching Figma design
  const activityItems: ActivityItem[] = [
    {
      id: '1',
      type: 'new_offer',
      reference: '126610LN',
      price: 12000,
      time: '1 min ago',
    },
    {
      id: '2',
      type: 'new_offer',
      reference: '126610LN',
      price: 12000,
      time: '1 min ago',
    },
    {
      id: '3',
      type: 'price_alert',
      reference: '126710BLRO',
      price: 11000,
      time: '1 min ago',
    },
  ];

  // Quick Access items matching Figma design
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
      title: 'Checks',
      subtitle: 'Check your serials and close deals confidently.',
      icon: 'shield',
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

  // News items matching Figma design
  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: 'Patek Philippe increases Nautilus production rate by 5%',
      source: 'Bloomberg',
      time: '2 days ago',
      imageUrl: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=200',
    },
    {
      id: '2',
      title: 'Rolex unveils new Submariner model with enhanced features',
      source: 'Bloomberg',
      time: '2 days ago',
      imageUrl: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=200',
    },
    {
      id: '3',
      title: 'Audemars Piguet introduces a new concept watch at the Geneva Watch Fair',
      source: 'Bloomberg',
      time: '2 days ago',
      imageUrl: 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=200',
    },
  ];

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
      case 'shield':
        return <ShieldCheckIcon size={16} color="#FFFFFF" />;
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
      borderRadius: sp(99),
      justifyContent: 'center',
      alignItems: 'center',
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
    // Activity section styles
    activitySection: {
      marginBottom: hp(32),
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header with Logo, Search Bar, and Profile */}
        <View style={styles.header}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <LogoIcon width={33} height={28} color="#212121" />
          </View>

          {/* Search Bar */}
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/market')}>
            <View style={styles.searchIcon}>
              <Magnifier size={18} color="#212121" />
            </View>
            <Text style={styles.searchPlaceholder}>Search watches...</Text>
          </TouchableOpacity>

          {/* Profile Button */}
          <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
            <UserCircleFilled size={32} color="#212121" />
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

          {activityItems.map((item) => (
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
          ))}
        </View>

        {/* Watchlist Section */}
        <View style={styles.watchlistSection}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/market')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.watchlistGrid}>
            {watchlistItems.map((watch) => {
              const isPositive = watch.priceChange > 0;
              return (
                <TouchableOpacity
                  key={watch.id}
                  style={styles.watchCard}
                  onPress={() => router.push(`/watch/${watch.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.watchImageContainer}>
                    <LinearGradient
                      colors={['#FFFFFF', '#F4F4F4']}
                      style={styles.watchImageGradient}
                    >
                      <Image source={watch.image} style={styles.watchImage} />
                    </LinearGradient>
                  </View>
                  <View style={styles.watchCardContent}>
                    <View>
                      <Text style={styles.watchName}>{watch.brand} {watch.model}</Text>
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
                      router.push('/(tabs)/dashboard' as any);
                    } else if (item.title === 'My Inventory') {
                      router.push('/market');
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
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {newsItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.newsItem}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.newsImage}
              />
              <View style={styles.newsContent}>
                <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.newsSourceRow}>
                  <Text style={styles.newsSource}>{item.source}</Text>
                  <Text style={styles.newsTime}> · </Text>
                  <Text style={styles.newsTime}>{item.time}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
