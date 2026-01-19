import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';

// Country flag component
function CountryFlag({ countryCode, size = 20 }: { countryCode: string; size?: number }) {
  const flagUrl = `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
  return (
    <Image
      source={{ uri: flagUrl }}
      style={{ width: size, height: size * 0.7, borderRadius: 2 }}
      resizeMode="cover"
    />
  );
}

// Back Arrow Icon
function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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

// Rating Star Icon
function RatingStarIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
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

// User Icon (for avatar placeholder)
function UserIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
        stroke="#666"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
        stroke="#666"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Message Icon
function MessageIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface OrderDetail {
  id: string;
  order_type: 'buy' | 'sell';
  brand: string;
  model: string;
  reference: string;
  watch_id?: string;
  price: number;
  currency: string;
  condition: string;
  country_code: string;
  country_name?: string;
  user_id: string;
  user_name?: string;
  user_profile_image?: string;
  user_rating: number;
  user_review_count: number;
  status: string;
  notes?: string;
  has_box: boolean;
  has_papers: boolean;
  created_at: string;
  watch_details?: {
    image_url?: string;
    images?: string[];
    year?: number;
    movement?: string;
    case_material?: string;
    bracelet_material?: string;
    case_size?: string;
    water_resistance?: string;
  };
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'EUR') => {
    const symbol = currency === 'EUR' ? '€' : currency;
    return `${symbol}${price.toLocaleString('de-DE')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleContactUser = async () => {
    if (!order?.user_id) return;

    try {
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: order.user_id,
      });

      if (response.data?.id) {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: response.data.id,
            name: response.data.name || order.user_name || 'User',
            watchId: order.id,
            watchBrand: order.brand,
            watchModel: order.model,
            watchPrice: order.price.toString(),
          },
        } as any);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const isOwnOrder = user?.id === order?.user_id;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#212121" />
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.goBackButton}>
            <Text style={styles.goBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#FFFFFF', '#F4F4F4']}
            locations={[0.067, 1]}
            style={styles.heroGradient}
          />
          {order.watch_details?.image_url ? (
            <Image
              source={{ uri: order.watch_details.image_url }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <LogoIcon width={80} height={50} color="rgba(33, 33, 33, 0.2)" />
            </View>
          )}

          {/* Header overlay */}
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BackArrow />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Order Info */}
        <View style={styles.infoSection}>
          {/* Order Type Badge */}
          <View style={[styles.orderTypeBadge, order.order_type === 'buy' ? styles.buyBadge : styles.sellBadge]}>
            <Text style={[styles.orderTypeText, order.order_type === 'buy' ? styles.buyText : styles.sellText]}>
              {order.order_type === 'buy' ? 'Buy Order' : 'Sell Order'}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{order.brand} {order.model}</Text>
          <Text style={styles.reference}>{order.reference}</Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>{formatPrice(order.price, order.currency)}</Text>
            <Text style={styles.addedTime}>Added {formatDate(order.created_at)}</Text>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfoRow}>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Condition</Text>
              <Text style={styles.quickInfoValue}>{order.condition}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Location</Text>
              <View style={styles.locationRow}>
                <CountryFlag countryCode={order.country_code} size={16} />
                <Text style={styles.quickInfoValue}>{order.country_name || order.country_code}</Text>
              </View>
            </View>
          </View>

          {/* Box & Papers */}
          <View style={styles.boxPapersRow}>
            <Text style={styles.quickInfoLabel}>Box & Papers</Text>
            <Text style={styles.quickInfoValue}>
              {order.has_box && order.has_papers
                ? 'Original box and papers'
                : order.has_box
                ? 'Box only'
                : order.has_papers
                ? 'Papers only'
                : 'None'}
            </Text>
          </View>

          {/* User Info - show for all orders */}
          <View style={styles.userSection}>
            <Text style={styles.sectionTitle}>
              {order.order_type === 'sell' ? 'Seller' : 'Buyer'}
            </Text>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/user/${order.user_id}` as any)}
            >
              <View style={styles.userAvatar}>
                {order.user_profile_image ? (
                  <Image source={{ uri: order.user_profile_image }} style={styles.avatarImage} />
                ) : (
                  <UserIcon />
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{order.user_name || 'Unknown'}</Text>
                <View style={styles.ratingRow}>
                  <RatingStarIcon />
                  <Text style={styles.ratingText}>
                    {order.user_rating?.toFixed(1) || '0.0'} ({order.user_review_count || 0})
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          {order.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          )}

          {/* Specifications */}
          {order.watch_details && (
            <View style={styles.specsSection}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              <View style={styles.specsList}>
                {order.watch_details.year && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Year</Text>
                    <Text style={styles.specValue}>{order.watch_details.year}</Text>
                  </View>
                )}
                {order.watch_details.movement && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Movement</Text>
                    <Text style={styles.specValue}>{order.watch_details.movement}</Text>
                  </View>
                )}
                {order.watch_details.case_material && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Case material</Text>
                    <Text style={styles.specValue}>{order.watch_details.case_material}</Text>
                  </View>
                )}
                {order.watch_details.case_size && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Case size</Text>
                    <Text style={styles.specValue}>{order.watch_details.case_size}</Text>
                  </View>
                )}
                {order.watch_details.bracelet_material && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Bracelet</Text>
                    <Text style={styles.specValue}>{order.watch_details.bracelet_material}</Text>
                  </View>
                )}
                {order.watch_details.water_resistance && (
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Water resistance</Text>
                    <Text style={styles.specValue}>{order.watch_details.water_resistance}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Contact Button - only for non-owners */}
      {!isOwnOrder && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactUser}>
            <MessageIcon />
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(20),
  },
  emptyText: {
    fontSize: fp(16),
    color: '#666',
    marginBottom: hp(16),
  },
  goBackButton: {
    paddingVertical: hp(12),
    paddingHorizontal: wp(24),
  },
  goBackText: {
    fontSize: fp(15),
    color: '#0088FF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(100),
  },
  heroContainer: {
    height: hp(340),
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImage: {
    width: '80%',
    height: '80%',
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingTop: hp(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
  },
  backButton: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoSection: {
    paddingHorizontal: wp(20),
    paddingTop: hp(20),
  },
  orderTypeBadge: {
    alignSelf: 'flex-start',
    paddingVertical: hp(6),
    paddingHorizontal: wp(12),
    borderRadius: sp(8),
    marginBottom: hp(12),
  },
  buyBadge: {
    backgroundColor: 'rgba(74, 160, 120, 0.1)',
  },
  sellBadge: {
    backgroundColor: 'rgba(0, 136, 255, 0.1)',
  },
  orderTypeText: {
    fontSize: fp(13),
    fontWeight: '600',
  },
  buyText: {
    color: '#4AA078',
  },
  sellText: {
    color: '#0088FF',
  },
  title: {
    fontSize: fp(24),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(4),
  },
  reference: {
    fontSize: fp(15),
    color: '#666',
    marginBottom: hp(16),
  },
  priceRow: {
    marginBottom: hp(20),
  },
  priceValue: {
    fontSize: fp(28),
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: hp(4),
  },
  addedTime: {
    fontSize: fp(13),
    color: '#999',
  },
  quickInfoRow: {
    flexDirection: 'row',
    gap: wp(32),
    marginBottom: hp(16),
  },
  quickInfoItem: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: fp(13),
    color: '#666',
    marginBottom: hp(4),
  },
  quickInfoValue: {
    fontSize: fp(15),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
  },
  boxPapersRow: {
    marginBottom: hp(24),
    paddingBottom: hp(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  userSection: {
    marginBottom: hp(24),
    paddingBottom: hp(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionTitle: {
    fontSize: fp(13),
    color: '#666',
    marginBottom: hp(12),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
  },
  userAvatar: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(2),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  ratingText: {
    fontSize: fp(13),
    color: '#666',
  },
  notesSection: {
    marginBottom: hp(24),
    paddingBottom: hp(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  notesText: {
    fontSize: fp(15),
    color: '#1D1D1F',
    lineHeight: fp(22),
  },
  specsSection: {
    marginBottom: hp(24),
  },
  specsList: {},
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: hp(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  specLabel: {
    fontSize: fp(14),
    color: '#666',
  },
  specValue: {
    fontSize: fp(14),
    fontWeight: '500',
    color: '#1D1D1F',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp(20),
    paddingTop: hp(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    backgroundColor: '#212121',
    paddingVertical: hp(16),
    borderRadius: sp(30),
  },
  contactButtonText: {
    fontSize: fp(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
