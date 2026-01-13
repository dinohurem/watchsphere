import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, FileCheckIcon, ClipboardList } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';

// Country flag component
function CountryFlag({ countryCode, size = 20 }: { countryCode: string; size?: number }) {
  const flagEmoji = countryCodeToFlag(countryCode);
  return (
    <Text style={{ fontSize: size * 0.9 }}>{flagEmoji}</Text>
  );
}

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface Order {
  id: string;
  order_type: 'buy' | 'sell';
  brand: string;
  model: string;
  reference: string;
  price: number;
  currency: string;
  condition: string;
  country_code: string;
  country_name: string;
  status: string;
  has_box: boolean;
  has_papers: boolean;
  created_at: string;
  watch_id?: string;
}

export default function OrdersScreen() {
  const { colors, fonts } = useTheme();
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
        setOrders(response.data);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      // Handle 405 Method Not Allowed and other errors gracefully
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

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('de-DE')}€`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleOrderPress = (order: Order) => {
    // Encode IDs to handle references with special characters (e.g., 5711/1A-010)
    if (order.watch_id) {
      router.push(`/market/${encodeURIComponent(order.watch_id)}` as any);
    } else if (order.reference) {
      router.push({
        pathname: `/market/${encodeURIComponent(order.reference)}`,
        params: {
          reference: order.reference,
          brand: order.brand,
          model: order.model,
        },
      } as any);
    }
  };

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
      fontFamily: fonts.semiBold,
      color: '#212121',
      textAlign: 'center',
      marginRight: sp(44),
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
      gap: wp(12),
    },
    tab: {
      flex: 1,
      paddingVertical: hp(12),
      borderRadius: sp(12),
      alignItems: 'center',
      backgroundColor: '#F6F7F9',
    },
    tabActive: {
      backgroundColor: '#212121',
    },
    tabText: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: wp(16),
      paddingBottom: hp(32),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
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
    },
    emptySubtitle: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      paddingHorizontal: wp(24),
    },
    orderCard: {
      backgroundColor: '#FAFAFA',
      borderRadius: sp(16),
      padding: wp(16),
      marginBottom: hp(12),
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: hp(12),
    },
    orderInfo: {
      flex: 1,
    },
    orderBrand: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(20),
    },
    orderReference: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      marginTop: hp(2),
    },
    orderPrice: {
      fontSize: fp(17),
      fontFamily: fonts.bold,
      color: '#212121',
    },
    orderDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(16),
    },
    orderDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(6),
    },
    orderDetailLabel: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
    },
    orderDetailValue: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    statusBadge: {
      paddingHorizontal: wp(10),
      paddingVertical: hp(4),
      borderRadius: sp(99),
      marginTop: hp(4),
    },
    statusActive: {
      backgroundColor: 'rgba(74, 160, 120, 0.1)',
    },
    statusPending: {
      backgroundColor: 'rgba(255, 193, 7, 0.1)',
    },
    statusCancelled: {
      backgroundColor: 'rgba(217, 4, 41, 0.1)',
    },
    statusText: {
      fontSize: fp(11),
      fontFamily: fonts.semiBold,
      textTransform: 'capitalize',
    },
    statusTextActive: {
      color: '#4AA078',
    },
    statusTextPending: {
      color: '#FFC107',
    },
    statusTextCancelled: {
      color: '#D90429',
    },
  });

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return { badge: styles.statusActive, text: styles.statusTextActive };
      case 'pending':
        return { badge: styles.statusPending, text: styles.statusTextPending };
      case 'cancelled':
      case 'expired':
        return { badge: styles.statusCancelled, text: styles.statusTextCancelled };
      default:
        return { badge: styles.statusActive, text: styles.statusTextActive };
    }
  };

  const pageTitle = orderType === 'buy' ? 'Buy Orders' : 'Sell Orders';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pageTitle}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#212121" />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <ClipboardList size={28} color="rgba(33, 33, 33, 0.4)" />
            </View>
            <Text style={styles.emptyTitle}>
              No {orderType} orders
            </Text>
            <Text style={styles.emptySubtitle}>
              {orderType === 'buy'
                ? 'Your buy orders will appear here when you place them'
                : 'Your sell orders will appear here when you create listings'}
            </Text>
          </View>
        ) : (
          orders.map((order) => {
            const statusStyle = getStatusStyle(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => handleOrderPress(order)}
                activeOpacity={0.7}
              >
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderBrand}>{order.brand} {order.model}</Text>
                    <Text style={styles.orderReference}>{order.reference}</Text>
                    <View style={[styles.statusBadge, statusStyle.badge]}>
                      <Text style={[styles.statusText, statusStyle.text]}>{order.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderPrice}>{formatPrice(order.price)}</Text>
                </View>
                <View style={styles.orderDetails}>
                  <View style={styles.orderDetail}>
                    <CountryFlag countryCode={order.country_code} size={16} />
                    <Text style={styles.orderDetailValue}>{order.country_name || order.country_code}</Text>
                  </View>
                  <View style={styles.orderDetail}>
                    <Text style={styles.orderDetailLabel}>Condition:</Text>
                    <Text style={styles.orderDetailValue}>{order.condition}</Text>
                  </View>
                  <View style={styles.orderDetail}>
                    <Text style={styles.orderDetailLabel}>Date:</Text>
                    <Text style={styles.orderDetailValue}>{formatDate(order.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
