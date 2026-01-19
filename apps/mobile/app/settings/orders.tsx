import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, ClipboardList } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { LogoIcon } from '@/components/LogoIcon';

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

interface Order {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: string;
  change: string;
  isPositive: boolean;
  image: string;
  status: string;
  order_type: 'buy' | 'sell';
  condition: string;
  country_code: string;
  country_name: string;
  has_box: boolean;
  has_papers: boolean;
  user_name: string;
  user_id: string;
}

export default function OrdersScreen() {
  const { fonts } = useTheme();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const orderType = (type === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [orderType]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders/my-orders', {
        params: { order_type: orderType }
      });
      if (response.data && Array.isArray(response.data)) {
        const formattedOrders: Order[] = response.data.map((order: any) => ({
          id: order.id || order._id,
          brand: `${order.brand || ''} ${order.model || ''}`.trim(),
          model: order.model || '',
          reference: order.reference || '',
          price: order.price ? `${order.price.toLocaleString('de-DE')}€` : '0€',
          change: order.price_change ? `${Math.abs(order.price_change).toFixed(1).replace('.', ',')}%` : '0%',
          isPositive: (order.price_change || 0) >= 0,
          image: order.cover_image || '',
          status: order.status || 'active',
          order_type: order.order_type || orderType,
          condition: order.condition || 'Unworn',
          country_code: order.country_code || 'US',
          country_name: order.country_name || 'United States',
          has_box: order.has_box || false,
          has_papers: order.has_papers || false,
          user_name: order.user_name || '',
          user_id: order.user_id || '',
        }));
        setOrders(formattedOrders);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.log('Orders not available:', error?.response?.status || error.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [orderType]);

  const renderOrderCard = (order: Order, isSingleItem: boolean = false) => {
    // Determine if this order is sold or completed
    const isSold = order.status === 'sold';
    const isCompleted = order.status === 'completed';
    const hasStatusLabel = isSold || isCompleted;

    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.watchCard, isSingleItem && styles.watchCardHalf]}
        onPress={() => router.push({
          pathname: '/market/watch-details',
          params: {
            orderId: order.id,
            reference: order.reference,
            brand: order.brand.split(' ')[0] || order.brand,
            model: order.model,
            price: order.price.replace(/[€.]/g, '').replace(',', '.'),
            condition: order.condition,
            country_code: order.country_code,
            country_name: order.country_name,
            has_box: String(order.has_box),
            has_papers: String(order.has_papers),
            user_name: order.user_name,
            user_id: order.user_id,
            fromOrderBook: 'true',
            order_type: order.order_type,
          },
        } as any)}
        activeOpacity={0.8}
      >
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
          {/* Status label overlay */}
          {hasStatusLabel && (
            <View style={[
              styles.statusLabelOverlay,
              isSold ? styles.soldLabelOverlay : styles.completedLabelOverlay
            ]}>
              <Text style={[
                styles.statusLabelText,
                isSold ? styles.soldLabelText : styles.completedLabelText
              ]}>
                {isSold ? 'Sold' : 'Completed'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.watchInfo}>
          <View style={styles.watchNameContainer}>
            <Text style={styles.watchBrand} numberOfLines={1}>{order.brand}</Text>
            <Text style={styles.watchReference} numberOfLines={1}>{order.reference}</Text>
          </View>

          <View style={styles.watchPriceRow}>
            <Text style={styles.watchPrice}>{order.price}</Text>
            <View style={[
              styles.changeBadge,
              { backgroundColor: order.isPositive ? 'rgba(74, 160, 120, 0.05)' : 'rgba(201, 57, 39, 0.05)' }
            ]}>
              {order.isPositive ? <TrendUpIcon /> : <TrendDownIcon />}
              <Text style={[
                styles.changeText,
                { color: order.isPositive ? '#4AA078' : '#C93927' }
              ]}>{order.change}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrdersGrid = () => {
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

  const pageTitle = orderType === 'buy' ? 'Buy Orders' : 'Sell Orders';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.semiBold }]}>{pageTitle}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <ClipboardList size={28} color="rgba(33, 33, 33, 0.4)" />
          </View>
          <Text style={[styles.emptyTitle, { fontFamily: fonts.semiBold }]}>
            No {orderType} orders
          </Text>
          <Text style={[styles.emptySubtitle, { fontFamily: fonts.regular }]}>
            {orderType === 'buy'
              ? 'Your buy orders will appear here when you place them'
              : 'Your sell orders will appear here when you create listings'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
          }
        >
          <View style={styles.watchGrid}>
            {renderOrdersGrid()}
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: wp(8),
    paddingVertical: hp(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  backButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fp(17),
    color: '#212121',
    textAlign: 'center',
    marginRight: sp(44),
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
    padding: wp(16),
    paddingBottom: hp(40),
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#212121',
    marginBottom: hp(8),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fp(14),
    color: 'rgba(33, 33, 33, 0.6)',
    textAlign: 'center',
    lineHeight: fp(20),
  },
  // Status label styles
  statusLabelOverlay: {
    position: 'absolute',
    top: hp(8),
    right: wp(8),
    paddingHorizontal: wp(8),
    paddingVertical: hp(4),
    borderRadius: sp(6),
  },
  soldLabelOverlay: {
    backgroundColor: 'rgba(201, 57, 39, 0.1)',
  },
  completedLabelOverlay: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statusLabelText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
  },
  soldLabelText: {
    color: '#c93927',
  },
  completedLabelText: {
    color: '#666666',
  },
});
