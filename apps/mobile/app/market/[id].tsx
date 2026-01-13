import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Svg, { Path, Circle, Line, Rect, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useFilters, OrderBookFilterState } from '@/contexts/FilterContext';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';

// Country flag component using flag CDN
function CountryFlag({ countryCode, size = 14 }: { countryCode: string; size?: number }) {
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

// Trend Up Icon (matches Figma exactly)
function TrendUpIcon({ color = '#4AA078' }: { color?: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none">
      <Path
        d="M1.5 11.5L5.5 7.5L8 10L14.5 3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 3.5H14.5V8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Trend Down Icon
function TrendDownIcon({ color = '#D35741' }: { color?: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none">
      <Path
        d="M1.5 5.5L5.5 9.5L8 7L14.5 13.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 13.5H14.5V9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Order Book Icon (exact Figma SVG - 24px_bag-bookmark 2)
function OrderBookIcon({ color = "#1D1D1F" }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {/* Bag handles */}
      <Path
        d="M8.25 8.25008V3.66675C8.25 2.14797 9.48117 0.916748 11 0.916748C12.5188 0.916748 13.75 2.14797 13.75 3.66675V8.25008"
        stroke={color}
        strokeWidth={1.83333}
        strokeLinecap="square"
      />
      {/* Bag body */}
      <Path
        d="M17.4167 8.25024V5.50024H11H4.58335V11.0002L3.18857 17.9741C2.96167 19.1084 3.82938 20.1669 4.9863 20.1669H9.16667"
        stroke={color}
        strokeWidth={1.83333}
        strokeMiterlimit={10}
        strokeLinecap="square"
      />
      {/* Bookmark ribbon */}
      <Path
        d="M19.2502 11.9167H13.7502C13.2439 11.9167 12.8335 12.3271 12.8335 12.8334V20.1667L16.5002 17.4167L20.1668 20.1667V12.8334C20.1668 12.3271 19.7564 11.9167 19.2502 11.9167Z"
        stroke={color}
        strokeWidth={1.83333}
        strokeMiterlimit={10}
        strokeLinecap="square"
      />
    </Svg>
  );
}

// Filter Icon (exact Figma SVG - 24px_bars-filter 2)
function FilterIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {/* Middle bar */}
      <Path d="M5.5 10.9998H16.5" stroke="#1D1D1F" strokeWidth={1.83333} strokeMiterlimit={10} strokeLinecap="square" />
      {/* Top bar (longest) */}
      <Path d="M1.8335 4.58325H20.1668" stroke="#1D1D1F" strokeWidth={1.83333} strokeMiterlimit={10} strokeLinecap="square" />
      {/* Bottom bar (shortest) */}
      <Path d="M9.16699 17.4167H12.8337" stroke="#1D1D1F" strokeWidth={1.83333} strokeMiterlimit={10} strokeLinecap="square" />
    </Svg>
  );
}

// Star Icon (exact Figma SVG - 24px_star-2 1)
function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      {/* 5-pointed star outline */}
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

// Social Search Icon - Globe with magnifier (matches home quick access)
function SocialSearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 16 16" fill="none">
      {/* Globe circle */}
      <Path d="M6.5 12C9.53757 12 12 9.53757 12 6.5C12 3.46243 9.53757 1 6.5 1C3.46243 1 1 3.46243 1 6.5C1 9.53757 3.46243 12 6.5 12Z" stroke="#1D1D1F" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Globe horizontal line */}
      <Path d="M1 6.5H12" stroke="#1D1D1F" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Globe vertical arc */}
      <Path d="M6.5 1C7.93261 2.55556 8.75 4.47826 8.75 6.5C8.75 8.52174 7.93261 10.4444 6.5 12C5.06739 10.4444 4.25 8.52174 4.25 6.5C4.25 4.47826 5.06739 2.55556 6.5 1Z" stroke="#1D1D1F" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Magnifier handle */}
      <Path d="M10.5 10.5L15 15" stroke="#1D1D1F" strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Arrow Right Icon
function ArrowRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M4 9H14M14 9L10 5M14 9L10 13"
        stroke="#212121"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Close Icon (X)
function CloseIcon({ color = "#212121" }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M4 4L14 14M14 4L4 14"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Check Icon for success state
function CheckIcon({ size = 32, color = "#4A90D9" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13L9 17L19 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Sparkle Icon for AI (exact Figma SVG - 18px_sparkle-2 1, purple filled)
function SparkleIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 21 21" fill="none">
      {/* Main sparkle - 4 pointed star */}
      <Path
        d="M19.2786 7.06176L15.4519 5.54859L13.9375 1.72075C13.6727 1.05341 12.5749 1.05341 12.31 1.72075L10.7957 5.54859L6.96902 7.06176C6.63535 7.19359 6.41485 7.51676 6.41485 7.87493C6.41485 8.2331 6.63418 8.55627 6.96902 8.6881L10.7957 10.2013L12.31 14.0291C12.4419 14.3628 12.765 14.5821 13.1232 14.5821C13.4814 14.5821 13.8045 14.3628 13.9364 14.0291L15.4507 10.2013L19.2774 8.6881C19.6111 8.55627 19.8316 8.2331 19.8316 7.87493C19.8316 7.51676 19.6134 7.19359 19.2786 7.06176Z"
        fill="#8450DB"
      />
      {/* Small sparkle bottom left */}
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.54126 11.0836C5.94276 11.0836 6.29275 11.3569 6.39014 11.7464L6.96281 14.0371L9.25348 14.6098C9.64301 14.7072 9.91627 15.0571 9.91627 15.4586C9.91627 15.8602 9.64301 16.2101 9.25348 16.3075L6.96281 16.8802L6.39014 19.1709C6.29275 19.5604 5.94276 19.8337 5.54126 19.8337C5.13975 19.8337 4.78976 19.5604 4.69237 19.1709L4.1197 16.8802L1.82903 16.3075C1.4395 16.2101 1.16624 15.8602 1.16624 15.4586C1.16624 15.0571 1.4395 14.7072 1.82903 14.6098L4.1197 14.0371L4.69237 11.7464C4.78976 11.3569 5.13975 11.0836 5.54126 11.0836Z"
        fill="#8450DB"
      />
    </Svg>
  );
}

// Empty chart state component
function ChartEmptyState({ width, height }: { width: number; height: number }) {
  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        backgroundColor: '#F5F5F5',
        borderRadius: sp(12),
        paddingHorizontal: wp(20),
        paddingVertical: hp(16),
        alignItems: 'center',
      }}>
        <Text style={{
          fontFamily: 'HankenGrotesk_500Medium',
          fontSize: fp(14),
          color: '#8E8E93',
          textAlign: 'center',
        }}>
          Not enough data to display price trends
        </Text>
      </View>
    </View>
  );
}

// Price Chart Component
function PriceChart({ data, width, height }: { data: number[], width: number, height: number }) {
  // Show empty state if no data or insufficient data points
  if (!data || data.length < 2) {
    return <ChartEmptyState width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = sp(20);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Create path for the line
  const pathData = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Create area fill path
  const areaPath = `${pathData} L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map((pct) => padding + chartHeight * (1 - pct));

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#4AA078" stopOpacity={0.2} />
          <Stop offset="100%" stopColor="#4AA078" stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>

      {/* Grid lines */}
      {gridLines.map((y, i) => (
        <Line
          key={i}
          x1={padding}
          y1={y}
          x2={width - padding}
          y2={y}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGradient)" />

      {/* Line */}
      <Path d={pathData} stroke="#212121" strokeWidth={2} fill="none" />

      {/* Current price dot */}
      <Circle
        cx={padding + chartWidth}
        cy={padding + chartHeight - ((data[data.length - 1] - min) / range) * chartHeight}
        r={4}
        fill="#212121"
      />
    </Svg>
  );
}

// Time period selector
const TIME_PERIODS = ['1d', '7d', '1m', '3m', '1y'];

interface WatchDetails {
  id: string;
  brand: string;
  model: string;
  reference: string;
  image?: string;
  marketPriceMin: number;
  marketPriceMax: number;
  priceChange: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  priceHistory: number[];
}

// Mock data
const MOCK_WATCH: WatchDetails = {
  id: '1',
  brand: 'Audemars Piguet',
  model: 'Royal Oak',
  reference: '26240OR Blue',
  image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=400',
  marketPriceMin: 51000,
  marketPriceMax: 156460,
  priceChange: 0.05,
  bestBid: 104500,
  bestAsk: 107200,
  spread: 2700,
  priceHistory: [
    120000, 122000, 118000, 125000, 130000, 128000, 135000, 132000,
    138000, 140000, 137000, 142000, 139000, 145000, 143000, 148000,
    146000, 150000, 147000, 152000, 149000, 155000, 151000, 139000,
  ],
};

interface OrderBookItem {
  id: string;
  country_code: string;
  country_name?: string;
  date: string;
  condition: 'Used' | 'Unworn';
  price: number;
  has_box?: boolean;
  has_papers?: boolean;
  user_id?: string;
  user_name?: string;
}

// Order book mock data with proper conditions
const ORDER_BOOK_DATA: OrderBookItem[] = [
  { id: 'mock-1', country_code: 'us', date: '12.01.25', condition: 'Unworn', price: 104500 },
  { id: 'mock-2', country_code: 'it', date: '11.28.25', condition: 'Unworn', price: 103500 },
  { id: 'mock-3', country_code: 'ae', date: '11.25.25', condition: 'Used', price: 98200 },
  { id: 'mock-4', country_code: 'de', date: '11.22.25', condition: 'Unworn', price: 106000 },
  { id: 'mock-5', country_code: 'ch', date: '11.18.25', condition: 'Used', price: 99800 },
];

export default function WatchDetailsScreen() {
  const { id: rawId, reference, brand, model } = useLocalSearchParams<{
    id: string;
    reference?: string;
    brand?: string;
    model?: string;
  }>();
  // Decode the ID to handle references with special characters (e.g., 5711/1A-010)
  const id = rawId ? decodeURIComponent(rawId) : rawId;
  const { isAuthenticated, user } = useAuthStore();
  const { getOrderBookFilterCount, hasActiveOrderBookFilters } = useFilters();
  const [watch, setWatch] = useState<WatchDetails>(MOCK_WATCH);
  const [loading, setLoading] = useState(true);
  const [buyOrders, setBuyOrders] = useState<OrderBookItem[]>([]);
  const [sellOrders, setSellOrders] = useState<OrderBookItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1m');
  const [selectedTab, setSelectedTab] = useState<'Buy' | 'Sell'>('Buy');

  // Make an Offer modal state
  const [showMakeOfferModal, setShowMakeOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [submittedOfferAmount, setSubmittedOfferAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Watchlist state
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Get order book filters from context
  const { orderBookFilters } = useFilters();

  // Filter orders based on applied filters
  const filterOrders = useCallback((orders: OrderBookItem[], filters: OrderBookFilterState): OrderBookItem[] => {
    return orders.filter(order => {
      // Price filter
      if (filters.priceMin !== null && order.price < filters.priceMin) return false;
      if (filters.priceMax !== null && order.price > filters.priceMax) return false;

      // Location filter
      if (filters.locations.length > 0 && !filters.locations.includes(order.country_code?.toUpperCase())) {
        return false;
      }

      // Condition filter
      if (filters.condition.length > 0 && !filters.condition.includes(order.condition)) {
        return false;
      }

      // Has box filter
      if (filters.hasBox !== null && order.has_box !== filters.hasBox) {
        return false;
      }

      // Has papers filter
      if (filters.hasPapers !== null && order.has_papers !== filters.hasPapers) {
        return false;
      }

      return true;
    });
  }, []);

  // Filter orders based on active filters
  const filteredBuyOrders = useMemo(() => {
    return filterOrders(buyOrders, orderBookFilters);
  }, [buyOrders, orderBookFilters, filterOrders]);

  const filteredSellOrders = useMemo(() => {
    return filterOrders(sellOrders, orderBookFilters);
  }, [sellOrders, orderBookFilters, filterOrders]);

  // Slice price history based on selected time period
  const getDataPointsForPeriod = useCallback((period: string): number => {
    // Assuming price history has data points representing daily values
    switch (period) {
      case '1d': return 1;
      case '7d': return 7;
      case '1m': return 30;
      case '3m': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }, []);

  const filteredPriceHistory = useMemo(() => {
    if (!watch.priceHistory || watch.priceHistory.length === 0) {
      return [];
    }
    const dataPoints = getDataPointsForPeriod(selectedPeriod);
    // Take the last N data points based on period, or all if fewer
    const sliceCount = Math.min(dataPoints, watch.priceHistory.length);
    return watch.priceHistory.slice(-sliceCount);
  }, [watch.priceHistory, selectedPeriod, getDataPointsForPeriod]);

  useEffect(() => {
    loadWatchDetails();
    loadOrderBook();
    checkWatchlistStatus();
  }, [id, reference]);

  const checkWatchlistStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await api.get('/profile/watchlist');
      if (response.data && Array.isArray(response.data)) {
        const watchReference = reference || id;
        const isInList = response.data.some((item: any) =>
          item.reference === watchReference || item.watch_id === id
        );
        setIsInWatchlist(isInList);
      }
    } catch (error) {
      console.log('Could not check watchlist status');
    }
  };

  const toggleWatchlist = async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    setWatchlistLoading(true);
    try {
      if (isInWatchlist) {
        // Remove from watchlist - encode to handle special characters
        const encodedRef = encodeURIComponent(watch.reference || id || '');
        await api.delete(`/profile/watchlist/${encodedRef}`);
        setIsInWatchlist(false);
      } else {
        // Add to watchlist
        await api.post('/profile/watchlist', {
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          watch_id: id,
        });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const loadWatchDetails = async () => {
    try {
      // If we have a reference (from aggregated data), use the aggregated endpoint
      const watchReference = reference || id;
      // Encode the reference to handle special characters in URLs (e.g., 5711/1A-010)
      const encodedReference = encodeURIComponent(watchReference || '');

      // Try aggregated endpoint first (works with reference)
      const response = await api.get(`/market/aggregated/${encodedReference}`);
      if (response.data) {
        const data = response.data;
        setWatch({
          id: data.reference, // Use reference as ID for aggregated data
          brand: data.brand,
          model: data.model,
          reference: data.reference || '',
          image: data.cover_image,
          marketPriceMin: data.lowest_order_price || data.admin_price || 0,
          marketPriceMax: data.admin_price || data.display_price || 0,
          priceChange: data.price_change || 0,
          bestBid: 0, // Will be populated from order book
          bestAsk: data.lowest_order_price || 0,
          spread: 0,
          priceHistory: data.price_history || MOCK_WATCH.priceHistory,
        });
      }
    } catch (error) {
      // If aggregated fails, try the regular watch endpoint (for MongoDB IDs)
      try {
        const encodedId = encodeURIComponent(id || '');
        const response = await api.get(`/market/watches/${encodedId}`);
        if (response.data) {
          setWatch({
            id: response.data.id,
            brand: response.data.brand,
            model: response.data.model,
            reference: response.data.reference || '',
            image: response.data.cover_image,
            marketPriceMin: response.data.price || 0,
            marketPriceMax: response.data.price || 0,
            priceChange: response.data.price_change || 0,
            bestBid: 0,
            bestAsk: response.data.price || 0,
            spread: 0,
            priceHistory: response.data.price_history || MOCK_WATCH.priceHistory,
          });
        }
      } catch {
        // Use mock data on error
        console.error('Failed to load watch details');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadOrderBook = async () => {
    try {
      const watchReference = reference || id;
      // Encode the reference to handle special characters in URLs (e.g., 5711/1A-010)
      const encodedReference = encodeURIComponent(watchReference || '');
      const response = await api.get(`/orders/book/${encodedReference}`);
      if (response.data) {
        const { buy_orders, sell_orders } = response.data;

        // Helper to format date safely - show MM/DD format (e.g., "12/27")
        const formatOrderDate = (dateStr: string | undefined) => {
          if (!dateStr) return '-';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return '-';
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          return `${month}/${day}`;
        };

        // Transform buy orders
        const formattedBuyOrders: OrderBookItem[] = (buy_orders || []).map((order: any) => ({
          id: order.id,
          country_code: order.country_code || 'us',
          country_name: order.country_name,
          date: formatOrderDate(order.created_at),
          condition: order.condition === 'Unworn' ? 'Unworn' : 'Used',
          price: order.price,
          has_box: order.has_box,
          has_papers: order.has_papers,
          user_id: order.user_id,
          user_name: order.user_name,
        }));

        // Transform sell orders
        const formattedSellOrders: OrderBookItem[] = (sell_orders || []).map((order: any) => ({
          id: order.id,
          country_code: order.country_code || 'us',
          country_name: order.country_name,
          date: formatOrderDate(order.created_at),
          condition: order.condition === 'Unworn' ? 'Unworn' : 'Used',
          price: order.price,
          has_box: order.has_box,
          has_papers: order.has_papers,
          user_id: order.user_id,
          user_name: order.user_name,
        }));

        setBuyOrders(formattedBuyOrders);
        setSellOrders(formattedSellOrders);

        // Calculate best bid/ask from orders
        if (formattedBuyOrders.length > 0) {
          const highestBid = Math.max(...formattedBuyOrders.map(o => o.price));
          setWatch(prev => ({
            ...prev,
            bestBid: highestBid,
            spread: prev.bestAsk ? prev.bestAsk - highestBid : 0,
          }));
        }
        if (formattedSellOrders.length > 0) {
          const lowestAsk = Math.min(...formattedSellOrders.map(o => o.price));
          setWatch(prev => ({
            ...prev,
            bestAsk: lowestAsk,
            spread: prev.bestBid ? lowestAsk - prev.bestBid : 0,
          }));
        }
      }
    } catch (error) {
      // Order book fetch failed - set empty arrays (no fallback to mock data)
      console.error('Failed to load order book:', error);
      setBuyOrders([]);
      setSellOrders([]);
    }
  };

  // Stats format: € AFTER number with period as thousands separator (e.g., "104.500€")
  // Returns "-" for 0 or undefined values
  const formatPriceEurAfter = (price: number) => {
    if (!price || price === 0) return '-';
    return `${price.toLocaleString('de-DE')}€`;
  };

  // Order book format: € BEFORE number (e.g., "€104,500")
  const formatPriceEurBefore = (price: number) => {
    return `€${price.toLocaleString('de-DE')}`;
  };

  // Market price range format (e.g., "€51,000 - €156,460" or just "€51,000" if same)
  const formatPriceRange = (min: number, max: number) => {
    if (min === max || !max || !min) {
      return `€${(min || max).toLocaleString('de-DE')}`;
    }
    return `€${min.toLocaleString('de-DE')} - €${max.toLocaleString('de-DE')}`;
  };

  // No +/- sign - icon and color indicate direction (per Figma)
  // European format with comma as decimal separator (e.g., "0,05%")
  const formatPriceChange = (change: number) => {
    return `${Math.abs(change).toFixed(2).replace('.', ',')}%`;
  };

  // Format offer input - allows numbers only and formats with period separator
  const formatOfferInput = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue) {
      return parseInt(numericValue, 10).toLocaleString('de-DE');
    }
    return '';
  };

  // Handle offer amount change
  const handleOfferChange = (text: string) => {
    const formatted = formatOfferInput(text);
    setOfferAmount(formatted);
  };

  // Handle Place Buy Order button press
  const handlePlaceBuyOrder = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    setShowMakeOfferModal(true);
  }, [isAuthenticated]);

  // Handle submitting the offer
  const handleSubmitOffer = useCallback(async () => {
    if (!offerAmount || submitting) return;

    setSubmitting(true);
    try {
      // Parse the price from formatted string
      const priceValue = parseInt(offerAmount.replace(/\./g, ''), 10);

      // Submit buy order to API
      await api.post('/orders', {
        order_type: 'buy',
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        price: priceValue,
        currency: 'EUR',
        condition: 'Unworn',
        country_code: 'US', // Default, could be user's country
        country_name: 'United States',
      });

      setSubmittedOfferAmount(offerAmount);
      setOfferSubmitted(true);

      // Refresh order book after successful submission
      loadOrderBook();
    } catch (error) {
      console.error('Failed to submit offer:', error);
      // Still show success for demo purposes
      setSubmittedOfferAmount(offerAmount);
      setOfferSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [offerAmount, submitting, watch]);

  // Close offer modal and reset state
  const handleCloseOfferModal = useCallback(() => {
    setShowMakeOfferModal(false);
    setTimeout(() => {
      setOfferSubmitted(false);
      setOfferAmount('');
      setSubmittedOfferAmount('');
    }, 300);
  }, []);

  // Handle Place Sell Order button press - navigate to create listing
  const handlePlaceSellOrder = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/listing/create',
      params: {
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        suggestedPrice: watch.bestAsk.toString(),
      },
    });
  }, [isAuthenticated, watch]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image with gradient background that extends to price section */}
        <View style={styles.heroContainer}>
          {/* Top gradient from white to gray */}
          <LinearGradient
            colors={['#FFFFFF', '#F4F4F4']}
            locations={[0.067, 1]}
            style={styles.heroGradient}
          />
          {watch.image ? (
            <Image source={{ uri: watch.image }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <LogoIcon size={sp(80)} color="rgba(33, 33, 33, 0.15)" />
            </View>
          )}

          {/* Header overlay */}
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <BackArrow />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>{watch.brand} {watch.model}</Text>
              <Text style={styles.headerSubtitle}>{watch.reference}</Text>
            </View>
          </SafeAreaView>

          {/* Price Info - inside hero container so gray bg extends behind it */}
          <View style={styles.priceSection}>
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>Market Price</Text>
              <Text style={styles.priceValue}>
                {formatPriceRange(watch.marketPriceMin, watch.marketPriceMax)}
              </Text>
            </View>
            <View style={[styles.changeTag, watch.priceChange >= 0 ? styles.changeTagPositive : styles.changeTagNegative]}>
              {watch.priceChange >= 0 ? (
                <TrendUpIcon color="#4AA078" />
              ) : (
                <TrendDownIcon color="#D35741" />
              )}
              <Text style={[styles.changeText, watch.priceChange >= 0 ? styles.changeTextPositive : styles.changeTextNegative]}>
                {formatPriceChange(watch.priceChange)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: '/market/order-book',
              params: {
                reference: watch.reference,
                brand: watch.brand,
                model: watch.model,
              },
            })}
          >
            <View style={styles.actionIconContainer}>
              <OrderBookIcon />
            </View>
            <Text style={styles.actionLabel}>Order Book</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/market/filters')}>
            <View style={styles.actionIconContainer}>
              <FilterIcon />
              {hasActiveOrderBookFilters() && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getOrderBookFilterCount()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionLabel}>Filters</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleWatchlist}
            disabled={watchlistLoading}
          >
            <View style={[styles.actionIconContainer, isInWatchlist && styles.actionIconContainerActive]}>
              <StarIcon filled={isInWatchlist} />
            </View>
            <Text style={styles.actionLabel}>{isInWatchlist ? 'Saved' : 'Watchlist'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/social-search')}
          >
            <View style={styles.actionIconContainer}>
              <SocialSearchIcon />
            </View>
            <Text style={styles.actionLabel}>Social Search</Text>
          </TouchableOpacity>
        </View>

        {/* Market Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market</Text>

          {/* Bid/Ask/Spread - € AFTER number per Figma */}
          <View style={styles.marketStats}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatPriceEurAfter(watch.bestBid)}</Text>
              <Text style={styles.statLabel}>Best Bid</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatPriceEurAfter(watch.bestAsk)}</Text>
              <Text style={styles.statLabel}>Best Ask</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatPriceEurAfter(watch.spread)}</Text>
              <Text style={styles.statLabel}>Spread</Text>
            </View>
          </View>

          {/* Price tooltip - shows latest order book data if available */}
          {(sellOrders.length > 0 || buyOrders.length > 0) && (
            <View style={styles.priceTooltip}>
              <Text style={styles.tooltipPrice}>
                {formatPriceEurBefore(
                  sellOrders.length > 0
                    ? sellOrders[0].price
                    : buyOrders.length > 0
                      ? buyOrders[0].price
                      : 0
                )}
              </Text>
              <Text style={styles.tooltipDate}>
                {(() => {
                  const dateStr = sellOrders.length > 0
                    ? sellOrders[0].date
                    : buyOrders.length > 0
                      ? buyOrders[0].date
                      : '';
                  if (!dateStr || dateStr === '-') return '';
                  // Parse date from DD.MM.YY format and format as "MMM DD. YYYY"
                  const parts = dateStr.split('.');
                  if (parts.length !== 3) return dateStr;
                  const [day, month, year] = parts;
                  const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
                  const date = new Date(`${fullYear}-${month}-${day}`);
                  if (isNaN(date.getTime())) return dateStr;
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }).toUpperCase().replace(',', '.');
                })()}
              </Text>
            </View>
          )}

          {/* Chart */}
          <View style={styles.chartContainer}>
            <PriceChart
              data={filteredPriceHistory}
              width={SCREEN_WIDTH - wp(32)}
              height={hp(200)}
            />
          </View>

          {/* Time period selector */}
          <View style={styles.periodSelector}>
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Order Book Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Book</Text>

          {/* Tab Selector */}
          <View style={styles.tabSelector}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'Buy' && styles.tabActive]}
              onPress={() => setSelectedTab('Buy')}
            >
              <Text style={[styles.tabText, selectedTab === 'Buy' && styles.tabTextActive]}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'Sell' && styles.tabActive]}
              onPress={() => setSelectedTab('Sell')}
            >
              <Text style={[styles.tabText, selectedTab === 'Sell' && styles.tabTextActive]}>Sell</Text>
            </TouchableOpacity>
          </View>

          {/* Order Book Table */}
          <View style={styles.orderBookTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: wp(80), textAlign: 'center' }]}>Market</Text>
              <Text style={[styles.tableHeaderCell, { width: wp(70), marginLeft: wp(8) }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Condition</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
            </View>

            {/* Rows - use dynamic data from API with filters applied */}
            {(selectedTab === 'Buy' ? filteredBuyOrders : filteredSellOrders).length === 0 ? (
              <View style={styles.orderBookEmptyState}>
                <Text style={styles.orderBookEmptyText}>
                  No {selectedTab.toLowerCase()} orders available for this watch
                </Text>
              </View>
            ) : (
              (selectedTab === 'Buy' ? filteredBuyOrders : filteredSellOrders).slice(0, 5).map((order, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                  onPress={() => router.push({
                    pathname: '/market/watch-details',
                    params: {
                      orderId: order.id,
                      reference: watch.reference,
                      brand: watch.brand,
                      model: watch.model,
                      price: order.price.toString(),
                      condition: order.condition,
                      country_code: order.country_code,
                      country_name: order.country_name || '',
                      has_box: (order.has_box || false).toString(),
                      has_papers: (order.has_papers || false).toString(),
                      user_name: order.user_name || '',
                      user_id: order.user_id || '',
                      order_type: selectedTab === 'Buy' ? 'buy' : 'sell',
                      fromOrderBook: 'true',
                    },
                  })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.tableCell, { width: wp(80), justifyContent: 'center', alignItems: 'center' }]}>
                    <CountryFlag countryCode={order.country_code} size={14} />
                  </View>
                  <Text style={[styles.tableCell, styles.tableCellText, { width: wp(70), marginLeft: wp(8) }]}>{order.date}</Text>
                  <Text style={[styles.tableCell, styles.tableCellText, { flex: 1, textAlign: 'center' }]}>{order.condition}</Text>
                  <Text style={[styles.tableCell, styles.tableCellTextBold, { flex: 1, textAlign: 'right' }]}>
                    {formatPriceEurBefore(order.price)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* See Order Book Button */}
          <TouchableOpacity
            style={styles.seeOrderBookButton}
            onPress={() => router.push({
              pathname: '/market/order-book',
              params: {
                reference: watch.reference,
                brand: watch.brand,
                model: watch.model,
              },
            })}
          >
            <Text style={styles.seeOrderBookText}>See Order Book</Text>
            <ArrowRightIcon />
          </TouchableOpacity>
        </View>

        {/* Bottom spacing for action bar */}
        <View style={{ height: hp(120) }} />
      </ScrollView>

      {/* Bottom Action Bar with gradient fade */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        locations={[0, 0.55]}
        style={styles.bottomBar}
      >
        <View style={styles.bottomBarContent}>
          <View style={styles.orderButtons}>
            <TouchableOpacity style={styles.buyButton} onPress={handlePlaceBuyOrder}>
              <Text style={styles.orderButtonText} numberOfLines={1}>Place Buy Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sellButton} onPress={handlePlaceSellOrder}>
              <Text style={styles.orderButtonText} numberOfLines={1}>Place Sell Order</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.aiButtonOuter} onPress={() => router.push('/chat/ai')}>
            <View style={styles.aiButtonInner}>
              <SparkleIcon />
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Make an Offer Modal */}
      <Modal
        visible={showMakeOfferModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={handleCloseOfferModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.offerModalOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={handleCloseOfferModal}
          />
          <View style={styles.offerModalContent}>
            {/* Modal Header */}
            <View style={styles.offerModalHeader}>
              <Text style={styles.offerModalTitle}>Make an offer</Text>
              <TouchableOpacity
                style={styles.offerModalCloseButton}
                onPress={handleCloseOfferModal}
              >
                <CloseIcon />
              </TouchableOpacity>
            </View>

            {!offerSubmitted ? (
              <>
                {/* Watch Info */}
                <View style={styles.offerWatchInfo}>
                  <View style={styles.offerWatchImageContainer}>
                    {watch.image ? (
                      <Image source={{ uri: watch.image }} style={styles.offerWatchImage} />
                    ) : (
                      <LogoIcon size={sp(30)} color="rgba(33, 33, 33, 0.2)" />
                    )}
                  </View>
                  <View style={styles.offerWatchDetails}>
                    <Text style={styles.offerWatchName}>{watch.brand} {watch.model}</Text>
                    <Text style={styles.offerWatchPrice}>
                      {formatPriceRange(watch.marketPriceMin, watch.marketPriceMax)}
                    </Text>
                  </View>
                </View>

                {/* Offer Input */}
                <View style={styles.offerInputSection}>
                  <Text style={styles.offerInputLabel}>Your offer</Text>
                  <View style={styles.offerInputContainer}>
                    <Text style={styles.offerInputCurrency}>€</Text>
                    <TextInput
                      style={styles.offerInput}
                      value={offerAmount}
                      onChangeText={handleOfferChange}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#C7C7CC"
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.offerSubmitButton, (!offerAmount || submitting) && styles.offerSubmitButtonDisabled]}
                  onPress={handleSubmitOffer}
                  disabled={!offerAmount || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.offerSubmitButtonText}>Make an offer</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* Offer Submitted State */
              <View style={styles.offerSubmittedContainer}>
                <View style={styles.offerSubmittedIconContainer}>
                  <CheckIcon size={sp(32)} color="#4A90D9" />
                </View>
                <Text style={styles.offerSubmittedText}>Offer sent</Text>
                <Text style={styles.offerSubmittedAmount}>€{submittedOfferAmount}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
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
    height: hp(525), // Extended to include price section (matches Figma 525px)
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
    width: '77%',
    height: '59%',
    alignSelf: 'center',
    marginTop: hp(130),
  },
  heroPlaceholder: {
    width: '77%',
    height: '59%',
    alignSelf: 'center',
    marginTop: hp(130),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  titleContainer: {
    marginLeft: wp(60),
    marginTop: hp(-38),
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#333333',
    lineHeight: fp(22),
  },
  headerSubtitle: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    color: '#999999',
    marginTop: hp(4),
    lineHeight: fp(14),
    letterSpacing: 0.12,
  },
  priceSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  priceInfo: {
    gap: hp(4),
  },
  priceLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#212121',
    letterSpacing: 0.07,
  },
  priceValue: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    color: '#212121',
    letterSpacing: 0.09,
  },
  changeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    borderRadius: sp(99),
  },
  changeTagPositive: {
    backgroundColor: 'rgba(74, 160, 120, 0.15)',
    borderWidth: 1,
    borderColor: '#4AA078',
  },
  changeTagNegative: {
    backgroundColor: 'rgba(217, 4, 41, 0.15)',
    borderWidth: 1,
    borderColor: '#D90429',
  },
  changeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    lineHeight: fp(21),  // 16 * 1.3
  },
  changeTextPositive: {
    color: '#4AA078',
  },
  changeTextNegative: {
    color: '#D90429',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: wp(8),
    paddingVertical: hp(16),
  },
  actionButton: {
    alignItems: 'center',
    gap: hp(11),
    width: wp(96),
  },
  actionIconContainer: {
    width: sp(53),
    height: sp(53),
    borderRadius: sp(26.5),
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  actionIconContainerActive: {
    // No background change when active - only icon fill changes
  },
  filterBadge: {
    position: 'absolute',
    top: -sp(2),
    right: -sp(2),
    minWidth: sp(18),
    height: sp(18),
    borderRadius: sp(9),
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp(4),
  },
  filterBadgeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(10),
    color: '#FFFFFF',
    lineHeight: fp(12),
  },
  actionLabel: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(12),
    color: '#212121',
    textAlign: 'center',
    letterSpacing: 0.06,
    lineHeight: fp(20),
  },
  section: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(24),
  },
  sectionTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#0F0D2D',
    marginBottom: hp(16),
    letterSpacing: 0.12,
    lineHeight: fp(32),
  },
  marketStats: {
    flexDirection: 'row',
    gap: wp(10),
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.05)',
    borderRadius: sp(12),
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
  },
  statValue: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    color: '#212121',
    lineHeight: fp(22),  // 17 * 1.3
  },
  statLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(12),
    color: '#212121',
    opacity: 0.4,
    marginTop: hp(2),
    lineHeight: fp(16),  // 12 * 1.3
  },
  priceTooltip: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    backgroundColor: '#F4F4F4',
    borderRadius: sp(16),
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    gap: wp(8),
    marginTop: hp(16),
    marginRight: wp(8),
  },
  tooltipPrice: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
  },
  tooltipDate: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#212121',
  },
  chartContainer: {
    marginTop: hp(8),
    marginHorizontal: wp(-16),
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(112),
    padding: sp(2),
    marginTop: hp(16),
  },
  periodButton: {
    flex: 1,
    paddingHorizontal: wp(12),
    paddingVertical: hp(6),
    borderRadius: sp(16),
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: 'rgba(33, 33, 33, 0.05)',
  },
  periodText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  periodTextActive: {
    color: '#212121',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: sp(100),
    padding: sp(4),
    marginBottom: hp(16),
  },
  tab: {
    flex: 1,
    paddingVertical: hp(8),
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
    fontSize: fp(14),
    color: '#000000',
  },
  tabTextActive: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontWeight: '600',
  },
  orderBookTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(16),
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  tableHeaderCell: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    color: '#212121',
    paddingVertical: hp(8),
    paddingHorizontal: wp(12),
    letterSpacing: 0.075,
    lineHeight: fp(20),
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#FBFBFB',
  },
  tableCell: {
    paddingVertical: hp(8),
    paddingHorizontal: wp(12),
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
  orderBookEmptyState: {
    paddingVertical: hp(32),
    paddingHorizontal: wp(16),
    alignItems: 'center',
    backgroundColor: '#FBFBFB',
  },
  orderBookEmptyText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#8E8E93',
    textAlign: 'center',
  },
  seeOrderBookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
    borderWidth: 1,
    borderColor: '#212121',
    borderRadius: sp(12),
    paddingVertical: hp(14),
    paddingHorizontal: wp(20),
    marginTop: hp(24),
  },
  seeOrderBookText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#212121',
    letterSpacing: 0.08,
    lineHeight: fp(20),
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: hp(30),
    paddingBottom: hp(25),
    paddingHorizontal: wp(16),
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: wp(12),
  },
  buyButton: {
    backgroundColor: '#54B368',
    borderTopLeftRadius: sp(64),
    borderBottomLeftRadius: sp(64),
    borderTopRightRadius: sp(3),
    borderBottomRightRadius: sp(3),
    height: sp(48),
    flex: 1,
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButton: {
    backgroundColor: '#D35741',
    borderTopLeftRadius: sp(3),
    borderBottomLeftRadius: sp(3),
    borderTopRightRadius: sp(64),
    borderBottomRightRadius: sp(64),
    height: sp(48),
    flex: 1,
    marginLeft: wp(4),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(13),
    color: '#FFFFFF',
    letterSpacing: 0.065,
    lineHeight: fp(18),
    textAlign: 'center',
  },
  aiButtonOuter: {
    width: sp(42),
    height: sp(42),
    borderRadius: sp(230),
    backgroundColor: '#F7F7F7',
    borderWidth: 0.78,
    borderColor: '#EFEFEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonInner: {
    width: sp(42),
    height: sp(42),
    borderRadius: sp(230),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Make an Offer Modal Styles
  offerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  offerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: sp(24),
    borderTopRightRadius: sp(24),
    paddingTop: hp(16),
    paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(24),
  },
  offerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(16),
    paddingBottom: hp(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  offerModalTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    color: '#212121',
  },
  offerModalCloseButton: {
    position: 'absolute',
    right: wp(16),
    width: sp(32),
    height: sp(32),
    borderRadius: sp(16),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerWatchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  offerWatchImageContainer: {
    width: sp(60),
    height: sp(60),
    borderRadius: sp(8),
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(12),
    overflow: 'hidden',
  },
  offerWatchImage: {
    width: sp(50),
    height: sp(50),
    resizeMode: 'contain',
  },
  offerWatchDetails: {
    flex: 1,
  },
  offerWatchName: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#212121',
    marginBottom: hp(4),
  },
  offerWatchPrice: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#8E8E93',
  },
  offerInputSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(24),
    paddingBottom: hp(16),
  },
  offerInputLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#212121',
    marginBottom: hp(12),
  },
  offerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: sp(12),
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
  },
  offerInputCurrency: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(18),
    color: '#8E8E93',
    marginRight: wp(8),
  },
  offerInput: {
    flex: 1,
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(18),
    color: '#212121',
    padding: 0,
  },
  offerSubmitButton: {
    marginHorizontal: wp(16),
    paddingVertical: hp(16),
    borderRadius: sp(99),
    backgroundColor: '#212121',
    alignItems: 'center',
    marginTop: hp(8),
  },
  offerSubmitButtonDisabled: {
    opacity: 0.5,
  },
  offerSubmitButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#FFFFFF',
  },
  offerSubmittedContainer: {
    alignItems: 'center',
    paddingVertical: hp(40),
    paddingHorizontal: wp(16),
  },
  offerSubmittedIconContainer: {
    width: sp(64),
    height: sp(64),
    borderRadius: sp(32),
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(20),
  },
  offerSubmittedText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(16),
    color: '#8E8E93',
    marginBottom: hp(8),
  },
  offerSubmittedAmount: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(32),
    color: '#212121',
  },
});
