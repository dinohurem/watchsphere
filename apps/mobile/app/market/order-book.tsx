import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';

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

// Close/X Icon
function CloseIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// WhatsApp chat icon
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="#1D1D1F"
      />
      <Path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.963 7.963 0 01-4.113-1.14l-.287-.172-2.978.78.795-2.898-.188-.299A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
        fill="#1D1D1F"
      />
    </Svg>
  );
}

// Grabber bar for sheet appearance
function GrabberBar() {
  return (
    <View style={styles.grabberContainer}>
      <View style={styles.grabber} />
    </View>
  );
}

interface OrderBookEntry {
  id: string;
  date: string;
  condition: string;
  price: number;
  currency: string;
  country_code: string;
  country_name?: string;
  has_box: boolean;
  has_papers: boolean;
  user_id: string;
  user_name?: string;
  whatsapp_phone?: string;
}

interface OrderBookData {
  reference: string;
  brand: string;
  model: string;
  buy_orders: OrderBookEntry[];
  sell_orders: OrderBookEntry[];
  lowest_ask?: number;
  highest_bid?: number;
  spread?: number;
}

// Mock data for when API is unavailable
const MOCK_ORDER_BOOK: OrderBookData = {
  reference: '26240OR',
  brand: 'Audemars Piguet',
  model: 'Royal Oak',
  buy_orders: [
    { id: '1', date: '12.01.25', condition: 'Unworn', price: 102000, currency: 'EUR', country_code: 'US', country_name: 'United States', has_box: true, has_papers: true, user_id: '1', user_name: 'John D.' },
    { id: '2', date: '11.28.25', condition: 'Unworn', price: 100500, currency: 'EUR', country_code: 'DE', country_name: 'Germany', has_box: true, has_papers: true, user_id: '2', user_name: 'Hans M.' },
    { id: '3', date: '11.25.25', condition: 'Used', price: 95200, currency: 'EUR', country_code: 'IT', country_name: 'Italy', has_box: false, has_papers: true, user_id: '3', user_name: 'Marco R.' },
    { id: '4', date: '11.22.25', condition: 'Unworn', price: 93000, currency: 'EUR', country_code: 'FR', country_name: 'France', has_box: true, has_papers: false, user_id: '4', user_name: 'Pierre L.' },
    { id: '5', date: '11.18.25', condition: 'Used', price: 89500, currency: 'EUR', country_code: 'AE', country_name: 'UAE', has_box: true, has_papers: true, user_id: '5', user_name: 'Ahmed K.' },
  ],
  sell_orders: [
    { id: '6', date: '12.01.25', condition: 'Unworn', price: 104500, currency: 'EUR', country_code: 'US', country_name: 'United States', has_box: true, has_papers: true, user_id: '6', user_name: 'Mike S.', whatsapp_phone: '+1234567890' },
    { id: '7', date: '11.28.25', condition: 'Unworn', price: 103500, currency: 'EUR', country_code: 'IT', country_name: 'Italy', has_box: true, has_papers: true, user_id: '7', user_name: 'Luigi P.', whatsapp_phone: '+3901234567' },
    { id: '8', date: '11.25.25', condition: 'Used', price: 98200, currency: 'EUR', country_code: 'AE', country_name: 'UAE', has_box: true, has_papers: false, user_id: '8', user_name: 'Saeed A.' },
    { id: '9', date: '11.22.25', condition: 'Unworn', price: 106000, currency: 'EUR', country_code: 'GB', country_name: 'United Kingdom', has_box: true, has_papers: true, user_id: '9', user_name: 'James W.', whatsapp_phone: '+4407123456' },
    { id: '10', date: '11.18.25', condition: 'Used', price: 99800, currency: 'EUR', country_code: 'CH', country_name: 'Switzerland', has_box: false, has_papers: true, user_id: '10', user_name: 'Felix B.' },
  ],
  lowest_ask: 104500,
  highest_bid: 102000,
  spread: 2500,
};

export default function OrderBookScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ reference: string; brand?: string; model?: string; watchId?: string }>();
  const [selectedTab, setSelectedTab] = useState<'Buy' | 'Sell'>('Sell');
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderBook();
  }, [params.reference]);

  const loadOrderBook = async () => {
    try {
      // Encode the reference to handle special characters in URLs (e.g., 5711/1A-010)
      const encodedReference = encodeURIComponent(params.reference || '');
      const response = await api.get(`/orders/book/${encodedReference}`);
      if (response.data) {
        setOrderBook(response.data);
      } else {
        // Use mock data with params
        setOrderBook({
          ...MOCK_ORDER_BOOK,
          reference: params.reference || MOCK_ORDER_BOOK.reference,
          brand: params.brand || MOCK_ORDER_BOOK.brand,
          model: params.model || MOCK_ORDER_BOOK.model,
        });
      }
    } catch (error) {
      // Use mock data on error
      setOrderBook({
        ...MOCK_ORDER_BOOK,
        reference: params.reference || MOCK_ORDER_BOOK.reference,
        brand: params.brand || MOCK_ORDER_BOOK.brand,
        model: params.model || MOCK_ORDER_BOOK.model,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'EUR') => {
    if (currency === 'EUR') return `€${price.toLocaleString('de-DE')}`;
    return `${currency} ${price.toLocaleString('de-DE')}`;
  };

  // Format date to show MM/YY format (e.g., "02/26")
  const formatOrderDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    // Try parsing MM.DD.YY format from backend API
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[2]}`;
    }
    // Fallback: parse as ISO date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${year}`;
  };

  const orders = selectedTab === 'Buy' ? orderBook?.buy_orders : orderBook?.sell_orders;

  const handleWhatsAppChat = (order: OrderBookEntry) => {
    if (!order.whatsapp_phone) return;
    const watchName = `${orderBook?.brand || ''} ${orderBook?.model || ''}`.trim();
    const watchCode = orderBook?.reference || '';
    const message = `Hi, is ${watchName} ${watchCode} available?\n${order.currency} ${order.price.toLocaleString('de-DE')} - thank you very much!`;
    const url = `https://wa.me/${order.whatsapp_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp. Make sure it is installed.');
    });
  };

  const renderOrderRow = ({ item, index }: { item: OrderBookEntry; index: number }) => {
    const isAlt = index % 2 === 0;
    return (
      <View
        style={[styles.tableRow, isAlt && styles.tableRowAlt]}
      >
        <View style={[styles.tableCell, styles.marketCellContainer]}>
          <CountryFlag countryCode={item.country_code} size={16} />
          <Text style={styles.marketCodeText}>{item.country_code?.toUpperCase()}</Text>
        </View>
        <View style={[styles.tableCell, styles.detailsCell, { alignItems: 'center' }]}>
          <Text style={styles.tableCellText}>{item.condition}</Text>
          <Text style={[styles.tableCellText, { fontSize: fp(11), color: '#999999' }]}>{formatOrderDate(item.date)}</Text>
        </View>
        <Text style={[styles.tableCell, styles.tableCellTextBold, styles.priceCell]}>{formatPrice(item.price, item.currency)}</Text>
        <TouchableOpacity
            style={[styles.tableCell, styles.chatCell]}
            onPress={() => handleWhatsAppChat(item)}
            disabled={!item.whatsapp_phone}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <WhatsAppIcon size={20} />
          </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Grabber */}
      <GrabberBar />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('orderBook.title')}</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <CloseIcon />
        </TouchableOpacity>
      </View>

      {/* Watch Info */}
      <View style={styles.watchInfo}>
        <Text style={styles.watchName}>{orderBook?.brand} {orderBook?.model}</Text>
        <Text style={styles.watchReference}>{orderBook?.reference}</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSelectorContainer}>
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'Sell' && styles.tabActive]}
            onPress={() => setSelectedTab('Sell')}
          >
            <Text style={[styles.tabText, selectedTab === 'Sell' && styles.tabTextActive]}>WTS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'Buy' && styles.tabActive]}
            onPress={() => setSelectedTab('Buy')}
          >
            <Text style={[styles.tabText, selectedTab === 'Buy' && styles.tabTextActive]}>WTB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Order Book Table */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.marketCell]}>{t('orderBook.market')}</Text>
          <Text style={[styles.tableHeaderCell, styles.detailsCell]}>Details</Text>
          <Text style={[styles.tableHeaderCell, styles.priceCell]}>{t('orderBook.price')}</Text>
          <Text style={[styles.tableHeaderCell, styles.chatCell]}>Chat</Text>
        </View>

        {/* Table Body */}
        <FlatList
          data={orders}
          renderItem={renderOrderRow}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tableContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{selectedTab === 'Buy' ? t('orderBook.noBuyOrders') : t('orderBook.noSellOrders')}</Text>
            </View>
          }
        />
      </View>

      {/* Summary Footer */}
      {orderBook && (orderBook.lowest_ask || orderBook.highest_bid) && (
        <View style={styles.summaryFooter}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('orderBook.bestBid')}</Text>
            <Text style={styles.summaryValue}>
              {orderBook.highest_bid ? formatPrice(orderBook.highest_bid) : '-'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('orderBook.bestAsk')}</Text>
            <Text style={styles.summaryValue}>
              {orderBook.lowest_ask ? formatPrice(orderBook.lowest_ask) : '-'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{t('orderBook.spread')}</Text>
            <Text style={styles.summaryValue}>
              {orderBook.spread ? formatPrice(orderBook.spread) : '-'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
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
  },
  grabberContainer: {
    alignItems: 'center',
    paddingTop: hp(12),
    paddingBottom: hp(8),
  },
  grabber: {
    width: wp(36),
    height: hp(5),
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
    borderRadius: sp(2.5),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    position: 'relative',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(20),
    color: '#212121',
    letterSpacing: 0.1,
  },
  closeButton: {
    position: 'absolute',
    right: wp(16),
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchInfo: {
    alignItems: 'center',
    paddingBottom: hp(16),
  },
  watchName: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#212121',
    letterSpacing: 0.08,
  },
  watchReference: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#999999',
    marginTop: hp(4),
  },
  tabSelectorContainer: {
    paddingHorizontal: wp(16),
    paddingBottom: hp(16),
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: sp(100),
    padding: sp(4),
  },
  tab: {
    flex: 1,
    paddingVertical: hp(10),
    borderRadius: sp(96),
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp(2) },
    shadowOpacity: 0.06,
    shadowRadius: sp(20),
    elevation: 2,
  },
  tabText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#000000',
  },
  tabTextActive: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
  },
  tableContainer: {
    flex: 1,
    paddingHorizontal: wp(16),
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.1)',
    paddingBottom: hp(12),
    marginBottom: hp(4),
  },
  tableHeaderCell: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  tableContent: {
    paddingBottom: hp(16),
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(14),
    borderRadius: sp(8),
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableCell: {
    paddingHorizontal: wp(8),
  },
  marketCellContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(4),
  },
  marketCodeText: {
    fontSize: fp(13),
    fontFamily: 'HankenGrotesk_400Regular',
    color: '#1D1D1F',
  },
  marketCell: {
    flex: 1,
    textAlign: 'center',
  },
  detailsCell: {
    flex: 1,
    textAlign: 'center',
  },
  priceCell: {
    flex: 1,
    textAlign: 'center',
  },
  chatCell: {
    flex: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCellText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(13),
    color: '#212121',
    letterSpacing: -0.26,
  },
  tableCellTextBold: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(13),
    color: '#212121',
    letterSpacing: -0.26,
  },
  emptyContainer: {
    paddingVertical: hp(40),
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#999999',
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: hp(16),
    paddingHorizontal: wp(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 33, 33, 0.1)',
    backgroundColor: '#FAFAFA',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    color: '#999999',
    marginBottom: hp(4),
  },
  summaryValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
  },
  summaryDivider: {
    width: 1,
    height: hp(32),
    backgroundColor: 'rgba(33, 33, 33, 0.1)',
  },
});
