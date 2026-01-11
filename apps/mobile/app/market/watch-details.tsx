import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';

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

// 3 Dots Menu Icon
function MoreIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z"
        stroke="#1D1D1F"
        strokeWidth={2}
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
  fromOrderBook?: string;
  order_type?: string;
}

interface WatchSpec {
  label: string;
  value: string;
}

// Mock watch specifications
const MOCK_SPECS = {
  basic: [
    { label: 'Brand', value: 'Audemars Piguet' },
    { label: 'Model', value: 'Royal Oak' },
    { label: 'Reference', value: '26240OR Blue' },
    { label: 'Year', value: '2023' },
  ],
  caliber: [
    { label: 'Movement', value: 'Automatic' },
    { label: 'Caliber', value: '4401' },
    { label: 'Power Reserve', value: '70 hours' },
    { label: 'Frequency', value: '28,800 vph' },
  ],
  case: [
    { label: 'Material', value: '18k Rose Gold' },
    { label: 'Diameter', value: '41mm' },
    { label: 'Thickness', value: '10.4mm' },
    { label: 'Water Resistance', value: '50m' },
    { label: 'Crystal', value: 'Sapphire' },
  ],
  bracelet: [
    { label: 'Material', value: '18k Rose Gold' },
    { label: 'Clasp', value: 'Folding Clasp' },
    { label: 'Buckle Material', value: '18k Rose Gold' },
  ],
  other: [
    { label: 'Dial Color', value: 'Blue Grande Tapisserie' },
    { label: 'Bezel', value: 'Fixed' },
    { label: 'Functions', value: 'Hours, Minutes, Seconds, Chronograph, Date' },
  ],
};

export default function WatchDetailsScreen() {
  const params = useLocalSearchParams<WatchDetailsParams>();
  const { user } = useAuthStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
  const userName = params.user_name || 'Seller';
  const orderUserId = params.user_id;
  const orderType = params.order_type;

  // Check if this is the current user's order (either buy or sell)
  const isOwnOrder = orderUserId === user?.id;

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE')}`;
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
          {/* Watch Image Placeholder - WatchSphere Logo */}
          <View style={styles.heroImagePlaceholder}>
            <LogoIcon width={80} height={50} color="rgba(33, 33, 33, 0.2)" />
          </View>

          {/* Header overlay */}
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BackArrow />
            </TouchableOpacity>
            {/* Show 3-dots menu for owner only, nothing for non-owners */}
            {isOwnOrder && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setShowMenu(true)}
              >
                <MoreIcon />
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </View>

        {/* Watch Info */}
        <View style={styles.infoSection}>
          {/* Price Row - Price on left, star on right */}
          <View style={styles.priceStarRow}>
            <View style={styles.priceColumn}>
              <Text style={styles.priceValue}>{formatPrice(price)}</Text>
              <Text style={styles.addedTime}>Added 2 hrs ago</Text>
            </View>
            {!isOwnOrder && (
              <TouchableOpacity
                style={styles.priceStarButton}
                onPress={() => setIsFavorite(!isFavorite)}
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
              <Text style={styles.quickInfoValue}>45mm</Text>
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
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.specsContainer}>
          {renderSpecSection('Basic info', MOCK_SPECS.basic)}
          {renderSpecSection('Caliber', MOCK_SPECS.caliber)}
          {renderSpecSection('Case', MOCK_SPECS.case)}
          {renderSpecSection('Bracelet/strap', MOCK_SPECS.bracelet)}
          {renderSpecSection('Other', MOCK_SPECS.other)}
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

      {/* Action Menu Modal */}
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
          <View style={styles.menuContainer}>
            {/* Edit */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push({
                  pathname: '/listing/edit',
                  params: {
                    orderId: params.orderId || '',
                    brand,
                    model,
                    reference,
                    price: price.toString(),
                  },
                });
              }}
            >
              <Text style={styles.menuItemText}>Edit</Text>
            </TouchableOpacity>

            {/* Mark as Sold */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push({
                  pathname: '/market/mark-sold',
                  params: {
                    orderId: params.orderId || '',
                    brand,
                    model,
                    reference,
                    price: price.toString(),
                  },
                });
              }}
            >
              <Text style={styles.menuItemText}>Mark as Sold</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={styles.menuItem}
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
                          await api.delete(`/orders/${params.orderId}`);
                          Alert.alert('Success', 'Listing deleted successfully');
                          router.back();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to delete listing');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

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
    width: '80%',
    height: '70%',
    alignSelf: 'center',
    marginTop: hp(100),
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(60),
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: sp(24),
    borderTopRightRadius: sp(24),
    paddingTop: hp(24),
    paddingBottom: hp(40),
    paddingHorizontal: wp(16),
  },
  menuItem: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
    borderRadius: sp(16),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(18),
    marginBottom: hp(8),
  },
  menuItemText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(17),
    color: '#212121',
  },
  menuItemTextDanger: {
    color: '#D35741',
  },
});
