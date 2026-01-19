import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Modal, Alert, Platform, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Country flag component using flag CDN
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

// Star/Favorite Icon (matches Figma design)
function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M11.0002 2.05811L13.786 7.70294L20.0166 8.60769L15.5084 13.0031L16.5726 19.208L11.0002 16.2793L5.4278 19.208L6.49205 13.0031L1.98389 8.60769L8.21447 7.70294L11.0002 2.05811Z"
        stroke="#1D1D1F"
        fill={filled ? "#1D1D1F" : "none"}
        strokeWidth={1.83333}
        strokeMiterlimit={10}
        strokeLinecap="square"
      />
    </Svg>
  );
}

// Edit Icon
function EditIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Delete/Trash Icon
function TrashIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6H5H21"
        stroke="#D35741"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
        stroke="#D35741"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Check Icon
function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M13.5 4.5L6 12L2.5 8.5"
        stroke="#4AA078"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// X Icon
function XIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M12 4L4 12M4 4L12 12"
        stroke="#D35741"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 3 Dots Menu Icon (vertical)
function MoreIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z"
        fill="#1D1D1F"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
        fill="#1D1D1F"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z"
        fill="#1D1D1F"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Sold Tag Icon
function SoldTagIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41L13.42 20.58C13.2343 20.766 13.0137 20.9135 12.7709 21.0141C12.5281 21.1148 12.2678 21.1666 12.005 21.1666C11.7422 21.1666 11.4819 21.1148 11.2391 21.0141C10.9963 20.9135 10.7757 20.766 10.59 20.58L2 12V2H12L20.59 10.59C20.9625 10.9647 21.1716 11.4716 21.1716 12C21.1716 12.5284 20.9625 13.0353 20.59 13.41Z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7H7.01"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Rating Star Icon (small, filled black)
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

interface WatchDetailsParams {
  orderId?: string;
  reference?: string;
  brand?: string;
  model?: string;
  price?: string;
  condition?: string;
  country_code?: string;
  country_name?: string;
  has_box?: string;
  has_papers?: string;
  user_name?: string;
  user_id?: string;
  user_profile_image?: string;
  user_rating?: string;
  user_review_count?: string;
  fromOrderBook?: string;
  order_type?: string;
  case_size?: string;
}

interface WatchSpec {
  label: string;
  value: string;
}

interface WatchDetails {
  image_url?: string;
  images?: string[];
  // Basic information
  year?: number;
  size?: string;
  movement?: string;
  case_material?: string;
  bracelet_material?: string;
  case_size?: string;
  gender?: string;
  availability?: string;
  // Caliber information
  movement_type?: string;
  caliber?: string;
  base_caliber?: string;
  power_reserve?: string;
  number_of_jewels?: number;
  // Case information
  case_diameter?: string;
  water_resistance?: string;
  bezel_material?: string;
  crystal?: string;
  dial?: string;
  dial_numerals?: string;
  // Bracelet/strap information
  bracelet_color?: string;
  clasp_type?: string;
  clasp_material?: string;
  clasp?: string;
  // Allow dynamic access
  [key: string]: string | number | string[] | undefined;
}

export default function WatchDetailsScreen() {
  const params = useLocalSearchParams() as WatchDetailsParams;
  const { user, isAuthenticated } = useAuthStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [userReviewCount, setUserReviewCount] = useState<number>(0);
  const [displayUserName, setDisplayUserName] = useState<string | null>(null);
  const [caseSize, setCaseSize] = useState<string | null>(params.case_size || null);
  const [watchDetails, setWatchDetails] = useState<WatchDetails | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  // Mark as Sold/Completed modal states
  const [showMarkSoldModal, setShowMarkSoldModal] = useState(false);
  const [showMarkCompletedModal, setShowMarkCompletedModal] = useState(false);
  const [markingAsSold, setMarkingAsSold] = useState(false);
  const [markingAsCompleted, setMarkingAsCompleted] = useState(false);

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageListRef = useRef<FlatList>(null);

  // Debug: log all params received
  console.log('WatchDetails params:', JSON.stringify(params, null, 2));

  const isFromOrderBook = params.fromOrderBook === 'true';
  const price = params.price ? parseFloat(params.price) : 104500;
  const condition = params.condition || 'Unworn';
  const countryCode = params.country_code || 'US';
  const countryName = params.country_name || 'United States';
  const hasBox = params.has_box === 'true';
  const hasPapers = params.has_papers === 'true';
  const brand = params.brand || 'Audemars Piguet';
  const model = params.model || 'Royal Oak';
  const reference = params.reference || '26240OR Blue';
  const userName = params.user_name || 'N/A';
  const orderUserId = params.user_id;
  const orderType = params.order_type;

  // Check if this is the current user's order (either buy or sell)
  // Use fetchedUserId (from API) as fallback since params.user_id may not always be passed
  const effectiveOrderUserId = orderUserId || fetchedUserId;
  const isOwnOrder = effectiveOrderUserId === user?.id;

  // Fetch order details to get user rating info, name, and watch details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (params.orderId) {
        try {
          const response = await api.get(`/orders/${params.orderId}`);
          if (response.data) {
            setUserProfileImage(response.data.user_profile_image || null);
            setUserRating(response.data.user_rating || 0);
            setUserReviewCount(response.data.user_review_count || 0);
            // Use user_name from API response if available
            if (response.data.user_name) {
              setDisplayUserName(response.data.user_name);
            }
            // Store user_id from API response for profile navigation
            if (response.data.user_id) {
              setFetchedUserId(response.data.user_id);
            }
            // Store created_at for "Added X ago" display
            if (response.data.created_at) {
              setCreatedAt(response.data.created_at);
            }
            // Store order status for labels
            if (response.data.status) {
              setOrderStatus(response.data.status);
            }
            // Get watch_details from API response
            if (response.data.watch_details) {
              setWatchDetails(response.data.watch_details);
              // Also set case_size if available
              if (response.data.watch_details.case_size) {
                setCaseSize(response.data.watch_details.case_size);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch order details:', error);
        }
      }
    };
    fetchOrderDetails();
  }, [params.orderId]);

  // Check watchlist status on mount
  useEffect(() => {
    const checkWatchlistStatus = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await api.get('/profile/watchlist');
        if (response.data && Array.isArray(response.data)) {
          const isInList = response.data.some((item: any) =>
            item.reference === reference || item.watch_id === params.orderId
          );
          setIsFavorite(isInList);
        }
      } catch (error) {
        console.log('Could not check watchlist status');
      }
    };
    checkWatchlistStatus();
  }, [isAuthenticated, reference, params.orderId]);

  const toggleWatchlist = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    setWatchlistLoading(true);
    try {
      if (isFavorite) {
        // Remove from watchlist
        await api.delete(`/profile/watchlist/${reference}`);
        setIsFavorite(false);
      } else {
        // Add to watchlist
        await api.post('/profile/watchlist', {
          brand: brand,
          model: model,
          reference: reference,
        });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Use API-fetched name, or params name, or fallback
  const effectiveUserName = displayUserName || userName;

  // Handler for marking sell order as sold
  const handleMarkAsSold = async () => {
    if (!params.orderId) {
      Alert.alert('Error', 'Order ID is missing');
      return;
    }

    setMarkingAsSold(true);
    try {
      await api.post(`/orders/${params.orderId}/mark-sold`);
      setShowMarkSoldModal(false);
      setOrderStatus('sold');
      Alert.alert('Success', 'Your watch has been marked as sold.', [
        { text: 'Go to Inventory', onPress: () => { router.dismissAll(); router.replace('/(tabs)/dashboard'); } },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (error: any) {
      console.error('Failed to mark as sold:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to mark as sold. Please try again.');
    } finally {
      setMarkingAsSold(false);
    }
  };

  // Handler for marking buy order as completed
  const handleMarkAsCompleted = async () => {
    if (!params.orderId) {
      Alert.alert('Error', 'Order ID is missing');
      return;
    }

    setMarkingAsCompleted(true);
    try {
      await api.post(`/orders/${params.orderId}/mark-completed`);
      setShowMarkCompletedModal(false);
      setOrderStatus('completed');
      Alert.alert('Success', 'Your buy order has been marked as completed.', [
        { text: 'Go to Profile', onPress: () => { router.dismissAll(); router.replace('/(tabs)/profile'); } },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (error: any) {
      console.error('Failed to mark as completed:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to mark as completed. Please try again.');
    } finally {
      setMarkingAsCompleted(false);
    }
  };

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE')}`;
  };

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

  // Effective user ID for profile navigation (from params or fetched from API)
  const effectiveUserId = orderUserId || fetchedUserId;

  // Build dynamic specs from watch_details - showing ALL populated fields
  const getBasicSpecs = (): WatchSpec[] => {
    const specs: WatchSpec[] = [
      { label: 'Brand', value: brand },
      { label: 'Model', value: model },
      { label: 'Reference', value: reference },
    ];
    if (watchDetails?.year) {
      specs.push({ label: 'Year', value: watchDetails.year.toString() });
    }
    if (watchDetails?.size || watchDetails?.case_size || caseSize) {
      specs.push({ label: 'Size', value: watchDetails?.size || watchDetails?.case_size || caseSize || '' });
    }
    if (watchDetails?.movement) {
      specs.push({ label: 'Movement', value: watchDetails.movement });
    }
    if (watchDetails?.case_material) {
      specs.push({ label: 'Case material', value: watchDetails.case_material });
    }
    if (watchDetails?.bracelet_material) {
      specs.push({ label: 'Bracelet material', value: watchDetails.bracelet_material });
    }
    if (watchDetails?.gender) {
      specs.push({ label: 'Gender', value: watchDetails.gender });
    }
    if (watchDetails?.availability) {
      specs.push({ label: 'Availability', value: watchDetails.availability });
    }
    return specs;
  };

  const getCaliberSpecs = (): WatchSpec[] => {
    const specs: WatchSpec[] = [];
    if (watchDetails?.movement_type) {
      specs.push({ label: 'Movement type', value: watchDetails.movement_type });
    }
    if (watchDetails?.caliber) {
      specs.push({ label: 'Caliber', value: watchDetails.caliber });
    }
    if (watchDetails?.base_caliber) {
      specs.push({ label: 'Base caliber', value: watchDetails.base_caliber });
    }
    if (watchDetails?.power_reserve) {
      specs.push({ label: 'Power reserve', value: watchDetails.power_reserve });
    }
    if (watchDetails?.number_of_jewels) {
      specs.push({ label: 'Number of jewels', value: watchDetails.number_of_jewels.toString() });
    }
    return specs;
  };

  const getCaseSpecs = (): WatchSpec[] => {
    const specs: WatchSpec[] = [];
    if (watchDetails?.case_material) {
      specs.push({ label: 'Material', value: watchDetails.case_material });
    }
    if (caseSize || watchDetails?.case_diameter || watchDetails?.case_size) {
      specs.push({ label: 'Diameter', value: caseSize || watchDetails?.case_diameter || watchDetails?.case_size || '' });
    }
    if (watchDetails?.water_resistance) {
      specs.push({ label: 'Water resistance', value: watchDetails.water_resistance });
    }
    if (watchDetails?.bezel_material) {
      specs.push({ label: 'Bezel material', value: watchDetails.bezel_material });
    }
    if (watchDetails?.crystal) {
      specs.push({ label: 'Crystal', value: watchDetails.crystal });
    }
    if (watchDetails?.dial) {
      specs.push({ label: 'Dial', value: watchDetails.dial });
    }
    if (watchDetails?.dial_numerals) {
      specs.push({ label: 'Dial numerals', value: watchDetails.dial_numerals });
    }
    return specs;
  };

  const getBraceletSpecs = (): WatchSpec[] => {
    const specs: WatchSpec[] = [];
    if (watchDetails?.bracelet_material) {
      specs.push({ label: 'Material', value: watchDetails.bracelet_material });
    }
    if (watchDetails?.bracelet_color) {
      specs.push({ label: 'Color', value: watchDetails.bracelet_color });
    }
    if (watchDetails?.clasp_type || watchDetails?.clasp) {
      specs.push({ label: 'Clasp type', value: watchDetails?.clasp_type || watchDetails?.clasp || '' });
    }
    if (watchDetails?.clasp_material) {
      specs.push({ label: 'Clasp material', value: watchDetails.clasp_material });
    }
    return specs;
  };

  const getOtherSpecs = (): WatchSpec[] => {
    // No longer needed - dial moved to Case specs
    return [];
  };

  const handleContactNow = async () => {
    // Debug: log the user_id being used
    console.log('Contact Now - orderUserId:', orderUserId, 'userName:', userName);

    // Check if user is trying to contact themselves
    if (orderUserId && orderUserId === user?.id) {
      Alert.alert('Info', 'This is your own listing.');
      return;
    }

    // If we have a real user_id, try to create a conversation
    if (orderUserId) {
      try {
        // Create or find an existing direct conversation with this user
        const response = await api.post('/chat/conversations/direct', {
          recipient_id: orderUserId,
        });

        if (response.data?.id) {
          // Navigate to chat with watch info in header
          // Use response.data.name which has the actual recipient name from API
          router.push({
            pathname: '/chat/[id]',
            params: {
              id: response.data.id,
              name: response.data.name || userName,
              watchId: params.orderId || '',
              watchBrand: brand,
              watchModel: model,
              watchPrice: price.toString(),
            },
          } as any);
          return;
        }
      } catch (error: any) {
        console.error('Error creating conversation:', error);
        // Fall through to navigate anyway with watch info
      }
    }

    // Navigate to new chat screen with watch info (for demo/mock data or if API fails)
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: 'new',
        name: userName,
        watchId: params.orderId || reference,
        watchBrand: brand,
        watchModel: model,
        watchPrice: price.toString(),
      },
    } as any);
  };

  const renderSpecSection = (title: string, specs: WatchSpec[]) => (
    <View style={styles.specSection}>
      <Text style={styles.specSectionTitle}>{title}</Text>
      {specs.map((spec, index) => (
        <View key={index} style={styles.specRow}>
          <Text style={styles.specLabel}>{spec.label}</Text>
          <Text style={styles.specValue}>{spec.value}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image with gradient background */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#FFFFFF', '#F4F4F4']}
            locations={[0.067, 1]}
            style={styles.heroGradient}
          />
          {/* Watch Images Carousel */}
          {watchDetails?.images && watchDetails.images.length > 0 ? (
            <View style={styles.imageCarouselContainer}>
              <FlatList
                ref={imageListRef}
                data={watchDetails.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentImageIndex(index);
                }}
                keyExtractor={(item, index) => `image-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.heroImageWrapper}>
                    <Image
                      source={{ uri: item }}
                      style={styles.heroImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
              />
              {/* Pagination dots */}
              {watchDetails.images.length > 1 && (
                <View style={styles.paginationDots}>
                  {watchDetails.images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : watchDetails?.image_url ? (
            <View style={styles.heroImageWrapper}>
              <Image
                source={{ uri: watchDetails.image_url }}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
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
            {/* Watch Title in Header */}
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{brand} {model}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {reference}, {condition}{caseSize ? `, ${caseSize}` : ''}
              </Text>
            </View>
            {/* Show 3-dots menu for owner only, empty spacer for non-owners */}
            {isOwnOrder ? (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setShowMenu(true)}
              >
                <MoreIcon />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </SafeAreaView>
        </View>

        {/* Watch Info */}
        <View style={styles.infoSection}>
          {/* Order Type Badge and Status Label */}
          {orderType && (
            <View style={styles.badgeRow}>
              <View style={[styles.orderTypeBadge, orderType === 'buy' ? styles.buyBadge : styles.sellBadge]}>
                <Text style={[styles.orderTypeText, orderType === 'buy' ? styles.buyText : styles.sellText]}>
                  {orderType === 'buy' ? 'Buy Order' : 'Sell Order'}
                </Text>
              </View>
              {/* Status Label for Sold/Completed orders
                  - Sell orders show "Sold" when status is sold
                  - Buy orders show "Completed" when status is completed or sold (defensive) */}
              {orderType === 'sell' && (orderStatus === 'sold' || orderStatus === 'completed') && (
                <View style={styles.soldBadge}>
                  <Text style={styles.soldText}>Sold</Text>
                </View>
              )}
              {orderType === 'buy' && (orderStatus === 'completed' || orderStatus === 'sold') && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
          )}

          {/* Price Row - Price on left, star on right */}
          <View style={styles.priceStarRow}>
            <View style={styles.priceColumn}>
              <Text style={styles.priceValue}>{formatPrice(price)}</Text>
              <Text style={styles.addedTime}>
                {createdAt ? `Added ${formatTimeAgo(createdAt)}` : 'Added recently'}
              </Text>
            </View>
            {!isOwnOrder && (
              <TouchableOpacity
                style={styles.priceStarButton}
                onPress={toggleWatchlist}
                disabled={watchlistLoading}
              >
                <StarIcon filled={isFavorite} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Info Rows - single column list */}
          <View style={styles.quickInfoList}>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>Condition:</Text>
              <Text style={styles.quickInfoValue}>{condition}</Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>Case size:</Text>
              <Text style={styles.quickInfoValue}>{caseSize || '—'}</Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>Box/papers</Text>
              <Text style={styles.quickInfoValue}>
                {hasBox && hasPapers ? 'Original box and papers' :
                 hasBox ? 'Original box' :
                 hasPapers ? 'Original papers' : 'None'}
              </Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>Location</Text>
              <View style={styles.locationRow}>
                <CountryFlag countryCode={countryCode} size={20} />
                <Text style={styles.quickInfoValue}>{countryName}</Text>
              </View>
            </View>
            {/* Seller/Buyer Row */}
            <TouchableOpacity
              style={styles.quickInfoRow}
              onPress={() => effectiveUserId && router.push(`/user/${effectiveUserId}` as any)}
              activeOpacity={0.7}
              disabled={!effectiveUserId}
            >
              <Text style={styles.quickInfoLabel}>{orderType === 'sell' ? 'Seller' : 'Buyer'}</Text>
              <View style={styles.sellerRow}>
                {effectiveUserName !== 'N/A' && (
                  <View style={styles.sellerAvatar}>
                    {userProfileImage ? (
                      <Image source={{ uri: userProfileImage }} style={styles.sellerAvatarImage} />
                    ) : (
                      <UserIcon />
                    )}
                  </View>
                )}
                <Text style={[styles.sellerName, effectiveUserId ? styles.sellerNameClickable : undefined]}>{effectiveUserName}</Text>
                {effectiveUserName !== 'N/A' && (
                  <>
                    <RatingStarIcon />
                    <Text style={styles.sellerRating}>{userRating.toFixed(1)} ({userReviewCount})</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.specsContainer}>
          {renderSpecSection('Basic info', getBasicSpecs())}
          {getCaliberSpecs().length > 0 && renderSpecSection('Caliber', getCaliberSpecs())}
          {getCaseSpecs().length > 0 && renderSpecSection('Case', getCaseSpecs())}
          {getBraceletSpecs().length > 0 && renderSpecSection('Bracelet/strap', getBraceletSpecs())}
          {getOtherSpecs().length > 0 && renderSpecSection('Other', getOtherSpecs())}
        </View>

        {/* Bottom spacing for action bar */}
        <View style={{ height: hp(120) }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        locations={[0, 0.55]}
        style={styles.bottomBar}
      >
        <View style={styles.bottomBarContent}>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactNow}>
            <Text style={styles.contactButtonText}>Contact Now</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Dropdown Menu Modal - positioned below 3-dot icon */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.dropdownContainer}>
            {/* Action buttons with glass effect */}
            <BlurView intensity={80} tint="light" style={styles.dropdownBlur}>
              <View style={styles.dropdownContent}>
                {/* Edit */}
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({
                      pathname: '/listing/create' as const,
                      params: {
                        editMode: 'true',
                        orderId: params.orderId || '',
                        orderType: orderType || 'sell',
                        brand,
                        model,
                        reference,
                        price: price.toString(),
                        condition,
                        country_code: countryCode,
                        country_name: countryName,
                        has_box: hasBox.toString(),
                        has_papers: hasPapers.toString(),
                      },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any);
                  }}
                >
                  <Text style={styles.actionSheetItemText}>Edit</Text>
                </TouchableOpacity>

                {/* Mark as Sold - only show for active sell orders (not sold or completed) */}
                {orderType === 'sell' && orderStatus === 'active' && (
                  <>
                    <View style={styles.actionSheetDivider} />
                    <TouchableOpacity
                      style={styles.actionSheetItem}
                      onPress={() => {
                        setShowMenu(false);
                        setShowMarkSoldModal(true);
                      }}
                    >
                      <Text style={styles.actionSheetItemText}>Mark as Sold</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Mark as Completed - only show for active buy orders (not completed or sold) */}
                {orderType === 'buy' && orderStatus === 'active' && (
                  <>
                    <View style={styles.actionSheetDivider} />
                    <TouchableOpacity
                      style={styles.actionSheetItem}
                      onPress={() => {
                        setShowMenu(false);
                        setShowMarkCompletedModal(true);
                      }}
                    >
                      <Text style={styles.actionSheetItemText}>Mark as Completed</Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.actionSheetDivider} />

                {/* Delete */}
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    setShowMenu(false);
                    Alert.alert(
                      'Delete Listing',
                      'Are you sure you want to delete this listing?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              console.log('Deleting order:', params.orderId);
                              await api.delete(`/orders/${params.orderId}`);
                              Alert.alert('Success', 'Listing deleted successfully', [
                                {
                                  text: 'OK',
                                  onPress: () => router.back(),
                                },
                              ]);
                            } catch (error: any) {
                              console.error('Delete error:', error?.response?.data || error);
                              Alert.alert('Error', error?.response?.data?.detail || 'Failed to delete listing');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.actionSheetItemText, styles.actionSheetItemTextDanger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Mark as Sold Confirmation Modal */}
      <Modal
        visible={showMarkSoldModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarkSoldModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContainer}>
            <View style={styles.confirmModalContent}>
              <Text style={styles.confirmModalTitle}>Mark as Sold</Text>
              <Text style={styles.confirmModalWatch}>{brand} {model}</Text>
              <Text style={styles.confirmModalReference}>{reference}</Text>
              <Text style={styles.confirmModalPrice}>{formatPrice(price)}</Text>

              <Text style={styles.confirmModalMessage}>
                Are you sure you want to mark this watch as sold? This will remove it from your inventory and the order book.
              </Text>

              <TouchableOpacity
                style={[styles.confirmModalButton, markingAsSold && styles.buttonDisabled]}
                onPress={handleMarkAsSold}
                disabled={markingAsSold}
              >
                {markingAsSold ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalButtonText}>Confirm Sale</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalCancelButton}
                onPress={() => setShowMarkSoldModal(false)}
                disabled={markingAsSold}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark as Completed Confirmation Modal */}
      <Modal
        visible={showMarkCompletedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarkCompletedModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContainer}>
            <View style={styles.confirmModalContent}>
              <Text style={styles.confirmModalTitle}>Mark as Completed</Text>
              <Text style={styles.confirmModalWatch}>{brand} {model}</Text>
              <Text style={styles.confirmModalReference}>{reference}</Text>
              <Text style={styles.confirmModalPrice}>{formatPrice(price)}</Text>

              <Text style={styles.confirmModalMessage}>
                Are you sure you want to mark this buy order as completed? This will remove it from the order book.
              </Text>

              <TouchableOpacity
                style={[styles.confirmModalButton, markingAsCompleted && styles.buttonDisabled]}
                onPress={handleMarkAsCompleted}
                disabled={markingAsCompleted}
              >
                {markingAsCompleted ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalButtonText}>Confirm Completion</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalCancelButton}
                onPress={() => setShowMarkCompletedModal(false)}
                disabled={markingAsCompleted}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 47 : 24;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(24),
  },
  heroContainer: {
    height: hp(380),
    position: 'relative',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.7,
    height: hp(200),
  },
  heroImageWrapper: {
    width: SCREEN_WIDTH,
    height: hp(380),
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: hp(40),
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(60),
  },
  imageCarouselContainer: {
    width: '100%',
    height: hp(380),
    position: 'relative',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: hp(8),
    left: 0,
    right: 0,
    gap: sp(8),
  },
  paginationDot: {
    width: sp(8),
    height: sp(8),
    borderRadius: sp(4),
    backgroundColor: 'rgba(33, 33, 33, 0.2)',
  },
  paginationDotActive: {
    backgroundColor: '#212121',
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
  backButton: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(999),
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: wp(12),
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    color: '#1D1D1F',
    lineHeight: fp(22),
  },
  headerSubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: 'rgba(29, 29, 31, 0.5)',
    lineHeight: fp(18),
  },
  headerSpacer: {
    width: sp(44),
    height: sp(44),
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: wp(8),
  },
  moreButton: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(999),
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(999),
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(24),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(8),
    marginBottom: hp(12),
  },
  orderTypeBadge: {
    paddingVertical: hp(6),
    paddingHorizontal: wp(12),
    borderRadius: sp(8),
  },
  buyBadge: {
    backgroundColor: 'rgba(74, 160, 120, 0.1)',
  },
  sellBadge: {
    backgroundColor: 'rgba(0, 136, 255, 0.1)',
  },
  soldBadge: {
    paddingVertical: hp(6),
    paddingHorizontal: wp(12),
    borderRadius: sp(8),
    backgroundColor: 'rgba(201, 57, 39, 0.1)',
  },
  completedBadge: {
    paddingVertical: hp(6),
    paddingHorizontal: wp(12),
    borderRadius: sp(8),
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  orderTypeText: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_600SemiBold',
  },
  buyText: {
    color: '#4AA078',
  },
  sellText: {
    color: '#0088FF',
  },
  soldText: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#c93927',
  },
  completedText: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#666666',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  watchTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#212121',
    letterSpacing: 0.12,
    lineHeight: fp(28),
  },
  watchSubtitle: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#999999',
    marginTop: hp(4),
  },
  priceStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(24),
  },
  priceColumn: {
    flex: 1,
    gap: hp(4),
  },
  priceValue: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#0F0D2D',
    letterSpacing: 0.12,
    lineHeight: fp(32),
  },
  addedTime: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#212121',
    opacity: 0.5,
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  priceStarButton: {
    width: sp(53),
    height: sp(53),
    borderRadius: sp(26.5),
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickInfoList: {
    marginTop: hp(24),
  },
  quickInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: hp(8),
  },
  quickInfoLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#212121',
    opacity: 0.5,
    letterSpacing: 0.075,
    lineHeight: fp(20),
    width: wp(128),
  },
  quickInfoValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
    flex: 1,
  },
  sellerAvatar: {
    width: sp(24),
    height: sp(24),
    borderRadius: sp(12),
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sellerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  sellerName: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  sellerNameClickable: {
    textDecorationLine: 'underline',
  },
  sellerRating: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  specsContainer: {
    paddingHorizontal: wp(16),
    paddingTop: hp(8),
  },
  specSection: {
    marginBottom: hp(24),
  },
  specSectionTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#0F0D2D',
    paddingVertical: hp(16),
    letterSpacing: 0.12,
    lineHeight: fp(32),
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: hp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  specLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#212121',
    opacity: 0.5,
    letterSpacing: 0.075,
    lineHeight: fp(20),
    width: wp(168),
  },
  specValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: hp(30),
    paddingBottom: hp(40),
    paddingHorizontal: wp(16),
  },
  bottomBarContent: {
    flexDirection: 'row',
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#212121',
    borderRadius: sp(999),
    paddingVertical: hp(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#FFFFFF',
    letterSpacing: 0.08,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  // Dropdown positioned below 3-dot icon
  dropdownContainer: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + hp(12) + sp(44) + hp(8), // status bar + header padding + button height + gap
    right: wp(16),
    minWidth: wp(160),
  },
  dropdownBlur: {
    borderRadius: sp(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  actionSheetItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(14),
    paddingHorizontal: wp(16),
  },
  actionSheetItemText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(17),
    color: '#212121',
  },
  actionSheetItemTextDanger: {
    color: '#D35741',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: wp(16),
  },
  // Confirmation Modal styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContainer: {
    width: SCREEN_WIDTH - wp(48),
    maxWidth: wp(340),
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(24),
    padding: wp(24),
    alignItems: 'center',
  },
  confirmModalTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(20),
    color: '#212121',
    marginBottom: hp(16),
  },
  confirmModalWatch: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    color: '#212121',
    textAlign: 'center',
  },
  confirmModalReference: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#999999',
    marginTop: hp(4),
  },
  confirmModalPrice: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#212121',
    marginTop: hp(12),
    marginBottom: hp(16),
  },
  confirmModalMessage: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    textAlign: 'center',
    lineHeight: fp(22),
    marginBottom: hp(24),
  },
  confirmModalButton: {
    backgroundColor: '#212121',
    borderRadius: sp(99),
    paddingVertical: hp(14),
    paddingHorizontal: wp(32),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: wp(180),
  },
  confirmModalButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#FFFFFF',
  },
  confirmModalCancelButton: {
    marginTop: hp(12),
    paddingVertical: hp(12),
    paddingHorizontal: wp(24),
  },
  confirmModalCancelText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#666666',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
