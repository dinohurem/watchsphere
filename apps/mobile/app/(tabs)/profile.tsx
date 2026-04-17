import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Circle } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { LogoIcon } from '@/components/LogoIcon';
import { User } from '@/components/icons';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';
import { useV2 } from '@/contexts/V2Context';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
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

// Settings Icon (Gear)
function SettingsIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke="#1D1D1F" strokeWidth={1.5} />
    </Svg>
  );
}

// Edit Icon (Pencil)
function EditIcon() {
  return (
    <Svg width={sp(13)} height={sp(13)} viewBox="0 0 13 13" fill="none">
      <Path
        d="M9.20833 1.08337C9.36903 0.922673 9.56043 0.795646 9.77124 0.709413C9.98205 0.62318 10.2079 0.579254 10.4358 0.579986C10.6637 0.580718 10.8892 0.62609 11.0994 0.713687C11.3097 0.801283 11.5003 0.929554 11.66 1.09129C11.8197 1.25303 11.9455 1.44488 12.0303 1.65584C12.1152 1.8668 12.158 2.09245 12.1561 2.32034C12.1542 2.54822 12.1077 2.77309 12.0193 2.98257C11.931 3.19205 11.8019 3.38169 11.6396 3.54046L4.0625 11.1175L0.8125 11.9167L1.61167 8.66671L9.20833 1.08337Z"
        stroke="#FFFFFF"
        strokeWidth={1.08333}
        strokeLinecap="round"
        strokeLinejoin="round"
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

// Chevron Right for See All
function ChevronRightSmall() {
  return (
    <Svg width={sp(8)} height={sp(14)} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Heart Icon for Empty State
function HeartIcon() {
  return (
    <Svg width={sp(28)} height={sp(28)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface FavoriteWatch {
  id: string;
  brand: string;
  model: string;
  reference: string;
  ws_code: string;
  price: string;
  priceChange: number;
  change: string;
  isPositive: boolean;
  image: string;
  wtsCount?: number;
  wtbCount?: number;
}

interface Order {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  image: string;
  status: string;
  orderType: 'buy' | 'sell';
  condition: string;
  country_code: string;
  country_name: string;
  has_box: boolean;
  has_papers: boolean;
  user_name: string;
  user_id: string;
}

// Shopping Bag Icon for Buy Orders
function ShoppingBagIcon() {
  return (
    <Svg width={sp(28)} height={sp(28)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 6H21"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Tag/Sell Icon for Sell Orders
function TagIcon() {
  return (
    <Svg width={sp(28)} height={sp(28)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41L13.42 20.58C13.2343 20.766 13.0137 20.9135 12.7709 21.0141C12.5281 21.1148 12.2678 21.1666 12.005 21.1666C11.7422 21.1666 11.4819 21.1148 11.2391 21.0141C10.9963 20.9135 10.7757 20.766 10.59 20.58L2 12V2H12L20.59 10.59C20.9625 10.9647 21.1716 11.4716 21.1716 12C21.1716 12.5284 20.9625 13.0353 20.59 13.41Z"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7H7.01"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Rating Star Icon (filled black)
function RatingStarIcon() {
  return (
    <Svg width={sp(14)} height={sp(14)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill="#1D1D1F"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { v2Enabled } = useV2();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [favoriteWatches, setFavoriteWatches] = useState<FavoriteWatch[]>([]);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  // Use profile image from auth store for reactive updates
  const profileImageUrl = user?.profile_image_url || null;
  const averageRating = user?.average_rating || 0;
  const reviewCount = user?.review_count || 0;

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadWatchlist();
      if (v2Enabled) {
        loadOrders();
      }
    }, [v2Enabled])
  );

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      console.log('Profile API response:', JSON.stringify(response.data, null, 2));
      // Sync profile data to auth store for global access
      updateUser({
        name: response.data.name,
        profile_image_url: response.data.profile_image_url,
        profile_image_thumbnail_url: response.data.profile_image_thumbnail_url,
        phone: response.data.phone,
        whatsapp_phone: response.data.whatsapp_phone,
        telegram_username: response.data.telegram_username,
        average_rating: response.data.average_rating || 0,
        review_count: response.data.review_count || 0,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await api.get('/orders/my-orders');
      if (response.data && Array.isArray(response.data)) {
        const buyOrdersData: Order[] = [];
        const sellOrdersData: Order[] = [];

        response.data.forEach((order: any) => {
          const formattedOrder: Order = {
            id: order.id || order._id,
            brand: order.brand || '',
            model: order.model || '',
            reference: order.reference || '',
            price: order.price || 0,
            priceChange: order.price_change || 0,
            image: order.cover_image || '',
            status: order.status || 'active',
            orderType: order.order_type as 'buy' | 'sell',
            condition: order.condition || 'Unworn',
            country_code: order.country_code || 'US',
            country_name: order.country_name || 'United States',
            has_box: order.has_box || false,
            has_papers: order.has_papers || false,
            user_name: order.user_name || '',
            user_id: order.user_id || '',
          };

          if (order.order_type === 'buy') {
            buyOrdersData.push(formattedOrder);
          } else if (order.order_type === 'sell') {
            sellOrdersData.push(formattedOrder);
          }
        });

        setBuyOrders(buyOrdersData);
        setSellOrders(sellOrdersData);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setBuyOrders([]);
      setSellOrders([]);
    }
  };

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/profile/watchlist');
      if (response.data && Array.isArray(response.data)) {
        const formattedWatches: FavoriteWatch[] = response.data.map((item: any) => ({
          id: item.id || item._id,
          brand: item.brand || '',
          model: item.model || '',
          reference: item.reference || '',
          ws_code: item.ws_code || item.reference || '',
          price: item.target_price ? `${item.target_price.toLocaleString('de-DE')}€` : '0€',
          priceChange: item.price_change || 0,
          change: item.price_change ? `${Math.abs(item.price_change).toFixed(1).replace('.', ',')}%` : '0%',
          isPositive: (item.price_change || 0) >= 0,
          image: item.image || item.cover_image || '',
          wtsCount: item.wts_count ?? 0,
          wtbCount: item.wtb_count ?? 0,
        }));
        setFavoriteWatches(formattedWatches);
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      setFavoriteWatches([]);
    }
  };

  const renderWatchCard = (watch: FavoriteWatch, isSingleItem: boolean = false) => (
    <TouchableOpacity
      key={watch.id}
      style={[styles.watchCard, isSingleItem && styles.watchCardHalf]}
      onPress={() => router.push({
        pathname: '/market/[id]',
        params: {
          id: encodeURIComponent(watch.reference || watch.id),
          reference: watch.reference,
          brand: watch.brand,
          model: watch.model,
          ws_code: watch.ws_code || '',
          fromUserWatchlist: 'true',
        },
      } as any)}
      activeOpacity={0.7}
    >
      {/* Watch Image with Gradient — matches home card */}
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
            <LogoIcon size={sp(48)} color="rgba(33, 33, 33, 0.15)" />
          )}
        </LinearGradient>
      </View>

      {/* Watch Info — same layout as home: brand / model / ws_code on separate lines */}
      <View style={styles.watchCardContent}>
        <View>
          <Text style={styles.watchCardBrand} numberOfLines={1}>{watch.brand}</Text>
          <Text style={styles.watchCardModel} numberOfLines={1}>{watch.model}</Text>
          <Text style={styles.watchCardRef} numberOfLines={1}>{watch.ws_code || watch.reference}</Text>
        </View>
        <View style={styles.watchPriceRow}>
          {v2Enabled ? (
            <View style={[
              styles.changeBadge,
              { backgroundColor: watch.isPositive ? 'rgba(74, 160, 120, 0.05)' : 'rgba(201, 57, 39, 0.05)' }
            ]}>
              {watch.isPositive ? <TrendUpIcon /> : <TrendDownIcon />}
              <Text style={[
                styles.changeText,
                { color: watch.isPositive ? '#4AA078' : '#C93927' }
              ]}>{Math.abs(watch.priceChange).toFixed(1)}%</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(4) }}>
              <View style={{ backgroundColor: 'rgba(74,160,120,0.1)', paddingHorizontal: wp(6), paddingVertical: hp(2), borderRadius: sp(99) }}>
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(10), color: '#4AA078' }}>WTS {watch.wtsCount ?? 0}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(91,155,213,0.1)', paddingHorizontal: wp(6), paddingVertical: hp(2), borderRadius: sp(99) }}>
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(10), color: '#5B9BD5' }}>WTB {watch.wtbCount ?? 0}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderOrderCard = (order: Order, isSingleItem: boolean = false) => {
    const isPositive = order.priceChange >= 0;
    const isSold = order.status === 'sold';
    const isCompleted = order.status === 'completed';
    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.watchCard, isSingleItem && styles.watchCardHalf]}
        onPress={() => router.push({
          pathname: '/market/watch-details',
          params: {
            orderId: order.id,
            reference: order.reference,
            brand: order.brand,
            model: order.model,
            price: String(order.price),
            condition: order.condition,
            country_code: order.country_code,
            country_name: order.country_name,
            has_box: String(order.has_box),
            has_papers: String(order.has_papers),
            user_name: order.user_name,
            user_id: order.user_id,
            fromOrderBook: 'true',
            order_type: order.orderType,
          },
        } as any)}
        activeOpacity={0.8}
      >
        {/* Watch Image with Gradient Background */}
        <View style={styles.watchImageContainer}>
          <LinearGradient
            colors={['#FFFFFF', '#F4F4F4']}
            style={styles.watchImageGradient}
          >
            {order.image ? (
              <Image
                source={{ uri: order.image }}
                style={styles.watchImage}
                resizeMode="contain"
              />
            ) : (
              <LogoIcon size={sp(48)} color="rgba(33, 33, 33, 0.15)" />
            )}
          </LinearGradient>
          {/* Status Badge - Sold for sell orders */}
          {isSold && order.orderType === 'sell' && (
            <View style={styles.orderSoldBadge}>
              <Text style={styles.orderSoldBadgeText}>{t('profile.sold')}</Text>
            </View>
          )}
          {/* Status Badge - Completed for buy orders */}
          {isCompleted && order.orderType === 'buy' && (
            <View style={styles.orderCompletedBadge}>
              <Text style={styles.orderCompletedBadgeText}>{t('profile.completed')}</Text>
            </View>
          )}
        </View>

        {/* Watch Info */}
        <View style={styles.watchInfo}>
          <View style={styles.watchNameContainer}>
            <Text style={styles.watchBrand} numberOfLines={1}>{`${order.brand} ${order.model}`.trim()}</Text>
            <Text style={styles.watchReference} numberOfLines={1}>{order.reference}</Text>
          </View>

          <View style={styles.watchPriceRow}>
            <Text style={styles.watchPrice}>{order.price.toLocaleString('de-DE')}€</Text>
            <View style={[
              styles.changeBadge,
              { backgroundColor: isPositive ? 'rgba(74, 160, 120, 0.05)' : 'rgba(201, 57, 39, 0.05)' }
            ]}>
              {isPositive ? <TrendUpIcon /> : <TrendDownIcon />}
              <Text style={[
                styles.changeText,
                { color: isPositive ? '#4AA078' : '#C93927' }
              ]}>{Math.abs(order.priceChange).toFixed(1).replace('.', ',')}%</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrdersGrid = (orders: Order[]) => {
    if (orders.length === 0) return null;

    const rows = [];
    for (let i = 0; i < orders.length; i += 2) {
      const isSingleInRow = i + 1 >= orders.length;
      rows.push(
        <View key={i} style={styles.watchRow}>
          {renderOrderCard(orders[i], isSingleInRow)}
          {orders[i + 1] && renderOrderCard(orders[i + 1], false)}
        </View>
      );
    }
    return rows;
  };

  const renderFavoritesGrid = (watches: FavoriteWatch[]) => {
    if (watches.length === 0) return null;

    const rows = [];
    for (let i = 0; i < watches.length; i += 2) {
      const isSingleInRow = i + 1 >= watches.length;
      rows.push(
        <View key={i} style={styles.watchRow}>
          {renderWatchCard(watches[i], isSingleInRow)}
          {watches[i + 1] && renderWatchCard(watches[i + 1], false)}
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('profile.myProfile')}</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/settings' as any)}
          activeOpacity={0.7}
        >
          <SettingsIcon />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {/* Avatar with Edit Button */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <User size={sp(40)} color="rgba(33, 33, 33, 0.4)" />
              )}
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile-settings' as any)}
              activeOpacity={0.8}
            >
              <EditIcon />
            </TouchableOpacity>
          </View>

          {/* User Name */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Fabian Wirtz'}</Text>
            {/* Rating - Clickable to go to user profile */}
            <TouchableOpacity
              style={styles.ratingRow}
              onPress={() => {
                if (user?.id) {
                  router.push(`/user/${user.id}` as any);
                }
              }}
              activeOpacity={0.7}
            >
              <RatingStarIcon />
              <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
              <Text style={styles.reviewCountText}>({reviewCount} {t('common.reviews')})</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Watchlist Section - shows all watchlisted watches (visible regardless of v2) */}
        <View style={styles.favoritesSection}>
          <View style={styles.favoritesHeader}>
            <Text style={styles.favoritesTitle}>{t('profile.watchlist')}</Text>
          </View>

          {/* Watch Cards Grid or Empty State */}
          {favoriteWatches.length > 0 ? (
            <View style={styles.watchGrid}>
              {renderFavoritesGrid(favoriteWatches)}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconContainer}>
                <HeartIcon />
              </View>
              <Text style={styles.emptyTitle}>{t('profile.noFavorites')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('profile.addToWatchlist')}
              </Text>
            </View>
          )}
        </View>

        {/* Orders - wrapped in subscription overlay */}
        {v2Enabled && <SubscriptionOverlay feature="orders" compact>
          <>
            {/* Buy Orders Section */}
            <View style={styles.favoritesSection}>
              <View style={styles.favoritesHeader}>
                <Text style={styles.favoritesTitle}>{t('profile.buyOrders')}</Text>
                {buyOrders.length > 0 && (
                  <TouchableOpacity
                    style={styles.seeAllButton}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/settings/orders', params: { type: 'buy' } } as any)}
                  >
                    <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
                    <ChevronRightSmall />
                  </TouchableOpacity>
                )}
              </View>

              {buyOrders.length > 0 ? (
                <View style={styles.watchGrid}>
                  {renderOrdersGrid(buyOrders.slice(0, 4))}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyIconContainer}>
                    <ShoppingBagIcon />
                  </View>
                  <Text style={styles.emptyTitle}>{t('profile.noBuyOrders')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t('profile.createBuyOrders')}
                  </Text>
                </View>
              )}
            </View>

            {/* Sell Orders Section */}
            <View style={styles.favoritesSection}>
              <View style={styles.favoritesHeader}>
                <Text style={styles.favoritesTitle}>{t('profile.sellOrders')}</Text>
                {sellOrders.length > 0 && (
                  <TouchableOpacity
                    style={styles.seeAllButton}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/settings/orders', params: { type: 'sell' } } as any)}
                  >
                    <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
                    <ChevronRightSmall />
                  </TouchableOpacity>
                )}
              </View>

              {sellOrders.length > 0 ? (
                <View style={styles.watchGrid}>
                  {renderOrdersGrid(sellOrders.slice(0, 4))}
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyIconContainer}>
                    <TagIcon />
                  </View>
                  <Text style={styles.emptyTitle}>{t('profile.noSellOrders')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t('profile.createSellOrders')}
                  </Text>
                </View>
              )}
            </View>

          </>
        </SubscriptionOverlay>}
      </ScrollView>
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
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    fontWeight: '600',
    color: '#212121',
    letterSpacing: 0.09,
    lineHeight: fp(20),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(120),
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: hp(20),
    gap: hp(12),
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: sp(87),
    height: sp(87),
    borderRadius: sp(43.5),
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: sp(26),
    height: sp(26),
    borderRadius: sp(13),
    backgroundColor: '#1D1D1F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(20),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(26),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
    marginTop: hp(4),
  },
  ratingText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  reviewCountText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    fontWeight: '500',
    color: 'rgba(33, 33, 33, 0.5)',
  },
  favoritesSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(8),
    gap: hp(16),
  },
  favoritesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoritesTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    fontWeight: '600',
    color: '#212121',
    letterSpacing: 0.09,
    lineHeight: fp(20),
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
  },
  seeAllText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    fontWeight: '500',
    color: 'rgba(33, 33, 33, 0.6)',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  watchGrid: {
    gap: hp(12),
  },
  watchRow: {
    flexDirection: 'row',
    gap: wp(12),
  },
  watchCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.05)',
    overflow: 'hidden',
  },
  watchCardHalf: {
    flex: 0,
    width: '48%',
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
  watchImage: {
    width: '66%',
    height: '86%',
  },
  orderSoldBadge: {
    position: 'absolute',
    top: hp(8),
    right: wp(8),
    backgroundColor: 'rgba(201, 57, 39, 0.1)',
    paddingHorizontal: wp(8),
    paddingVertical: hp(4),
    borderRadius: sp(6),
  },
  orderSoldBadgeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(10),
    color: '#c93927',
  },
  orderCompletedBadge: {
    position: 'absolute',
    top: hp(8),
    right: wp(8),
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    paddingHorizontal: wp(8),
    paddingVertical: hp(4),
    borderRadius: sp(6),
  },
  orderCompletedBadgeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(10),
    color: '#666666',
  },
  // Watchlist card content — matches home page card layout exactly
  watchCardContent: {
    padding: wp(12),
    paddingTop: hp(10),
    gap: hp(4),
  },
  watchCardBrand: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#212121',
    lineHeight: fp(17),
  },
  watchCardModel: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_400Regular',
    color: '#212121',
    lineHeight: fp(17),
  },
  watchCardRef: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_500Medium',
    color: '#212121',
    opacity: 0.5,
    lineHeight: fp(17),
  },
  // Legacy styles kept for order cards
  watchInfo: {
    padding: wp(16),
    paddingTop: hp(12),
    gap: hp(12),
  },
  watchNameContainer: {
    gap: 0,
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
    alignItems: 'center',
    marginTop: hp(4),
  },
  watchPrice: {
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
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(40),
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
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#212121',
    marginBottom: hp(8),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    fontWeight: '400',
    color: 'rgba(33, 33, 33, 0.6)',
    textAlign: 'center',
    lineHeight: fp(20),
  },
});
