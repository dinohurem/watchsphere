import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, TagPlus, PriceAlertUp, PriceAlertDown } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { api } from '@/services/api';

type NotificationType = 'new_offer' | 'price_alert_up' | 'price_alert_down' | 'offer_accepted' | 'offer_rejected';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference: string | null;
  orderId: string | null;
  price: number | null;
  currency: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    reference: string | null;
    order_id: string | null;
    price: number | null;
    currency: string;
    is_read: boolean;
    created_at: string;
  }>;
  total: number;
  unread_count: number;
}

export default function NotificationsScreen() {
  const { colors, fonts } = useTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatTimeAgo = (dateString: string): string => {
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

  const loadNotifications = async () => {
    try {
      let allNotifications: NotificationItem[] = [];

      // First, try to get user notifications
      try {
        const response = await api.get<NotificationResponse>('/notifications');
        const data = response.data;

        const mappedNotifications: NotificationItem[] = data.notifications.map((n) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          body: n.body,
          reference: n.reference,
          orderId: n.order_id,
          price: n.price,
          currency: n.currency,
          isRead: n.is_read,
          createdAt: n.created_at,
        }));

        allNotifications = [...mappedNotifications];
      } catch (error) {
        console.error('Failed to load user notifications:', error);
      }

      // Also try to get admin activity (for admins only)
      try {
        const activityResponse = await api.get('/activity/admin/activity?limit=50');
        if (activityResponse.data && activityResponse.data.length > 0) {
          const activityNotifications: NotificationItem[] = activityResponse.data
            // Only include activities that have a watch reference in metadata
            .filter((item: any) => item.metadata?.reference)
            .map((item: any) => ({
              id: `activity-${item.id}`,
              type: item.activity_type === 'price_alert' ? 'price_alert_down' as NotificationType :
                    item.activity_type === 'buy_order_placed' || item.activity_type === 'sell_order_placed' ? 'new_offer' as NotificationType :
                    'new_offer' as NotificationType,
              title: item.description || 'Activity',
              body: item.description || '',
              reference: item.metadata.reference,
              orderId: item.entity_id || null,
              price: item.metadata?.price || null,
              currency: item.metadata?.currency || 'EUR',
              isRead: true, // Activity items are considered "read"
              createdAt: item.created_at,
            }));

          // Merge and deduplicate by reference and timestamp
          const existingRefs = new Set(allNotifications.map(n => `${n.reference}-${n.createdAt}`));
          const uniqueActivity = activityNotifications.filter(
            a => !existingRefs.has(`${a.reference}-${a.createdAt}`)
          );
          allNotifications = [...allNotifications, ...uniqueActivity];
        }
      } catch {
        // Not admin or activity endpoint failed - that's okay
      }

      // Sort by createdAt descending
      allNotifications.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const handleNotificationPress = async (item: NotificationItem) => {
    // Mark as read
    if (!item.isRead) {
      try {
        await api.post(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to watch-details page with order info
    if (item.orderId) {
      // Determine order type from notification type
      const orderType = item.type === 'new_offer' ? 'buy' : 'sell';
      router.push({
        pathname: '/market/watch-details',
        params: {
          orderId: item.orderId,
          reference: item.reference || '',
          price: item.price?.toString() || '',
          order_type: orderType,
          fromOrderBook: 'true',
        },
      } as any);
    } else if (item.reference) {
      router.push(`/watch/${encodeURIComponent(item.reference)}` as any);
    }
  };

  const getIconConfig = (type: NotificationType) => {
    switch (type) {
      case 'new_offer':
        return {
          Icon: TagPlus,
          color: '#0088FF',
          bgColor: 'rgba(0, 136, 255, 0.05)',
        };
      case 'price_alert_up':
      case 'offer_accepted':
        return {
          Icon: PriceAlertUp,
          color: '#4AA078',
          bgColor: 'rgba(74, 160, 120, 0.05)',
        };
      case 'price_alert_down':
      case 'offer_rejected':
        return {
          Icon: PriceAlertDown,
          color: '#D90429',
          bgColor: 'rgba(217, 4, 41, 0.05)',
        };
      default:
        return {
          Icon: TagPlus,
          color: '#0088FF',
          bgColor: 'rgba(0, 136, 255, 0.05)',
        };
    }
  };

  // Separate notifications into new (unread or recent) and earlier
  const newNotifications = notifications.filter((n) => !n.isRead);
  const earlierNotifications = notifications.filter((n) => n.isRead);

  const renderNotificationItem = (item: NotificationItem, isLast: boolean) => {
    const iconConfig = getIconConfig(item.type);
    const IconComponent = iconConfig.Icon;

    const displayTitle = item.type === 'new_offer' ? 'New offer' :
                         item.type === 'price_alert_up' ? 'Price changed for' :
                         item.type === 'price_alert_down' ? 'Price changed for' :
                         item.title;

    const priceDisplay = item.price
      ? `${item.currency === 'EUR' ? '€' : item.currency} ${item.price.toLocaleString()}`
      : '';

    return (
      <View key={item.id} style={styles.notificationItemWrapper}>
        <TouchableOpacity
          style={styles.notificationItem}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bgColor }]}>
            <IconComponent size={18} color={iconConfig.color} />
          </View>
          <View style={styles.notificationContentWrapper}>
            <View style={styles.notificationContent}>
              <View style={styles.titleRow}>
                <Text style={styles.notificationTitle}>
                  <Text style={styles.titleRegular}>{displayTitle} </Text>
                  {item.reference && <Text style={styles.titleBold}>{item.reference}</Text>}
                </Text>
              </View>
              {priceDisplay && <Text style={styles.notificationPrice}>{priceDisplay}</Text>}
              <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
        {!isLast && (
          <View style={styles.separatorRow}>
            <View style={styles.separatorSpacer} />
            <View style={styles.separator} />
          </View>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp(8),
      height: sp(44),
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      left: wp(8),
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: wp(16),
      paddingTop: hp(16),
    },
    section: {
      marginBottom: hp(24),
    },
    sectionTitle: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#626262',
      letterSpacing: 0.075,
      marginBottom: hp(12),
    },
    notificationItemWrapper: {
      marginBottom: 0,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(10),
      paddingVertical: hp(8),
    },
    iconContainer: {
      width: sp(40),
      height: sp(40),
      borderRadius: sp(540),
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationContentWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationContent: {
      flex: 1,
      gap: hp(2),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationTitle: {
      fontSize: fp(15),
      lineHeight: fp(19),
      letterSpacing: 0.075,
      color: '#212121',
    },
    titleRegular: {
      fontFamily: fonts.regular,
    },
    titleBold: {
      fontFamily: fonts.semiBold,
    },
    notificationPrice: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#626262',
      lineHeight: fp(19),
      letterSpacing: 0.075,
    },
    notificationTime: {
      fontSize: fp(11),
      fontFamily: fonts.regular,
      color: '#747474',
      lineHeight: fp(14),
      letterSpacing: 0.055,
    },
    unreadDot: {
      width: sp(8),
      height: sp(8),
      borderRadius: sp(540),
      backgroundColor: '#C93927',
      marginLeft: wp(10),
    },
    separatorRow: {
      flexDirection: 'row',
      marginTop: hp(16),
    },
    separatorSpacer: {
      width: wp(50),
    },
    separator: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E5EA',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp(32),
    },
    emptyText: {
      fontSize: fp(16),
      fontFamily: fonts.medium,
      color: '#626262',
      textAlign: 'center',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {/* NEW Section */}
            {newNotifications.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NEW</Text>
                {newNotifications.map((item, index) =>
                  renderNotificationItem(item, index === newNotifications.length - 1)
                )}
              </View>
            )}

            {/* EARLIER Section */}
            {earlierNotifications.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EARLIER</Text>
                {earlierNotifications.map((item, index) =>
                  renderNotificationItem(item, index === earlierNotifications.length - 1)
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
