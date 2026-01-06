import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';

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

// Heart/Favorite Icon
function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill={filled ? '#D35741' : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={filled ? '#D35741' : '#1D1D1F'}
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

  // Check if this is the current user's sell order
  const isOwnSellOrder = orderUserId === user?.id && orderType === 'sell';

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE')}`;
  };

  const handleContactNow = async () => {
    // Open WhatsApp or email contact
    const message = `Hi, I'm interested in the ${brand} ${model} (${reference}) listed at ${formatPrice(price)}.`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to email
        const emailUrl = `mailto:?subject=Interest in ${brand} ${model}&body=${encodeURIComponent(message)}`;
        await Linking.openURL(emailUrl);
      }
    } catch (error) {
      console.error('Error opening contact:', error);
    }
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
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=400' }}
            style={styles.heroImage}
            resizeMode="contain"
          />

          {/* Header overlay */}
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BackArrow />
            </TouchableOpacity>
            <View style={styles.headerRightButtons}>
              {isOwnSellOrder && (
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => setShowMenu(true)}
                >
                  <MoreIcon />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={() => setIsFavorite(!isFavorite)}
              >
                <HeartIcon filled={isFavorite} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Watch Info */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.watchTitle}>{brand} {model}</Text>
              <Text style={styles.watchSubtitle}>{reference}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>{formatPrice(price)}</Text>
            <Text style={styles.addedTime}>Added 2 hrs ago</Text>
          </View>

          {/* Quick Info Grid */}
          <View style={styles.quickInfoGrid}>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Condition</Text>
              <Text style={styles.quickInfoValue}>{condition}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Case size</Text>
              <Text style={styles.quickInfoValue}>41mm</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Box/papers</Text>
              <View style={styles.boxPapersRow}>
                {hasBox ? <CheckIcon /> : <XIcon />}
                <Text style={styles.quickInfoValue}>/</Text>
                {hasPapers ? <CheckIcon /> : <XIcon />}
              </View>
            </View>
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoLabel}>Location</Text>
              <View style={styles.locationRow}>
                <CountryFlag countryCode={countryCode} size={18} />
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
              <SoldTagIcon />
              <Text style={styles.menuItemText}>Mark as Sold</Text>
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: hp(16),
  },
  priceValue: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(22),
    color: '#212121',
  },
  addedTime: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(13),
    color: '#999999',
  },
  quickInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: hp(24),
    marginHorizontal: wp(-8),
  },
  quickInfoItem: {
    width: '50%',
    paddingHorizontal: wp(8),
    marginBottom: hp(16),
  },
  quickInfoLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    color: '#999999',
    marginBottom: hp(4),
  },
  quickInfoValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
  },
  boxPapersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(6),
  },
  specsContainer: {
    paddingHorizontal: wp(16),
    paddingTop: hp(24),
  },
  specSection: {
    marginBottom: hp(24),
  },
  specSectionTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    color: '#212121',
    marginBottom: hp(12),
    letterSpacing: 0.09,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: hp(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.06)',
  },
  specLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#666666',
  },
  specValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    color: '#212121',
    textAlign: 'right',
    flex: 1,
    marginLeft: wp(16),
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
    borderRadius: sp(12),
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
    paddingTop: hp(16),
    paddingBottom: hp(40),
    paddingHorizontal: wp(24),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(16),
    gap: wp(16),
  },
  menuItemText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(17),
    color: '#212121',
  },
});
