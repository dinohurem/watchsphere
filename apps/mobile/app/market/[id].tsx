import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, GestureResponderEvent, Linking, Alert, FlatList, Keyboard, InputAccessoryView, Dimensions } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Svg, { Path, Circle, Line, Rect, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useFilters, OrderBookFilterState } from '@/contexts/FilterContext';
import { wp, hp, sp, fp, SCREEN_WIDTH } from '@/utils/responsive';
import { LogoIcon } from '@/components/LogoIcon';
import { useGuide } from '@/contexts/GuideContext';
import { useV2 } from '@/contexts/V2Context';
import { GUIDE_MOCK_WATCH_DETAILS, GUIDE_MOCK_BUY_ORDERS, GUIDE_MOCK_SELL_ORDERS } from '@/data/guideMockData';

// Country flag component using flag CDN
function countryCodeToEmoji(code: string): string {
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function CountryFlag({ countryCode, size = 14 }: { countryCode: string; size?: number }) {
  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.3 }}>
      {countryCodeToEmoji(countryCode)}
    </Text>
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

// WhatsApp Icon
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

// Price Chart Component with interactive touch
interface PriceChartProps {
  data: number[];
  width: number;
  height: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}

function PriceChart({ data, width, height, selectedIndex, onSelectIndex }: PriceChartProps) {
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

  // Calculate point coordinates for interaction
  const getPointAtIndex = (index: number) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((data[index] - min) / range) * chartHeight;
    return { x, y };
  };

  // Handle touch to find closest point
  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;

    // Find the closest data point based on X coordinate
    const relativeX = locationX - padding;
    const indexFloat = (relativeX / chartWidth) * (data.length - 1);
    const closestIndex = Math.max(0, Math.min(data.length - 1, Math.round(indexFloat)));

    onSelectIndex(closestIndex);
  };

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

  // Get selected point position
  const selectedPoint = selectedIndex !== null ? getPointAtIndex(selectedIndex) : null;

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
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

        {/* Selected point indicator */}
        {selectedPoint && (
          <>
            {/* Vertical dashed line */}
            <Line
              x1={selectedPoint.x}
              y1={padding}
              x2={selectedPoint.x}
              y2={padding + chartHeight}
              stroke="rgba(33, 33, 33, 0.3)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            {/* Selected point dot */}
            <Circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={6}
              fill="#FFFFFF"
              stroke="#212121"
              strokeWidth={2}
            />
          </>
        )}

        {/* Current price dot (only show if no selection or selection is the last point) */}
        {(selectedIndex === null || selectedIndex === data.length - 1) && (
          <Circle
            cx={padding + chartWidth}
            cy={padding + chartHeight - ((data[data.length - 1] - min) / range) * chartHeight}
            r={4}
            fill="#212121"
          />
        )}
      </Svg>
    </View>
  );
}

// Time period selector
const TIME_PERIODS = ['1d', '7d', '1m', '3m', '1y'];

interface WatchDetails {
  id: string;
  brand: string;
  model: string;
  reference: string;
  ws_code?: string;
  image?: string;
  currency: string;
  marketPriceMin: number;
  marketPriceMax: number;
  priceChange: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  priceHistory: number[];
  wtsCount?: number;
  wtbCount?: number;
}

// Default empty watch state
const DEFAULT_WATCH: WatchDetails = {
  id: '',
  brand: '',
  model: '',
  reference: '',
  image: undefined,
  currency: 'EUR',
  marketPriceMin: 0,
  marketPriceMax: 0,
  priceChange: 0,
  bestBid: 0,
  bestAsk: 0,
  spread: 0,
  priceHistory: [],
};

interface OrderBookItem {
  id: string;
  country_code: string;
  country_name?: string;
  date: string;
  condition: string;
  price: number;
  currency?: string;
  has_box?: boolean;
  has_papers?: boolean;
  user_id?: string;
  user_name?: string;
  whatsapp_phone?: string;
  remarks?: string;
  created_at?: string;
}

export default function WatchDetailsScreen() {
  const { id: rawId, reference, brand, model, ws_code: wsCodeParam, fromUserWatchlist } = useLocalSearchParams<{
    id: string;
    reference?: string;
    brand?: string;
    model?: string;
    ws_code?: string;
    fromUserWatchlist?: string;
  }>();
  // Decode the ID to handle references with special characters (e.g., 5711/1A-010)
  const id = rawId ? decodeURIComponent(rawId) : rawId;
  const { isAuthenticated, user } = useAuthStore();
  const { isGuideActive } = useGuide();
  const { v2Enabled } = useV2();
  const { getOrderBookFilterCount, hasActiveOrderBookFilters } = useFilters();
  const [watch, setWatch] = useState<WatchDetails>(DEFAULT_WATCH);
  const [loading, setLoading] = useState(true);
  const [buyOrders, setBuyOrders] = useState<OrderBookItem[]>([]);
  const [sellOrders, setSellOrders] = useState<OrderBookItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1m');
  const [selectedTab, setSelectedTab] = useState<'Buy' | 'Sell'>('Sell');

  // Make an Offer modal state
  const [showMakeOfferModal, setShowMakeOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [submittedOfferAmount, setSubmittedOfferAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Watchlist state
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Watch alert state
  const [watchAlerts, setWatchAlerts] = useState<any[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [remarksBubble, setRemarksBubble] = useState<{
    text: string;
    anchorX: number;
    anchorY: number;
    anchorWidth: number;
    anchorHeight: number;
  } | null>(null);
  const [remarksBubbleSize, setRemarksBubbleSize] = useState<{ width: number; height: number } | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [alertListMode, setAlertListMode] = useState(true);
  const [alertConfig, setAlertConfig] = useState({
    notify_wts: false,
    notify_wtb: false,
    target_month: '',
    target_year: '',
    year_direction: 'exactly',
    condition: 'any',
    locations: [] as string[],
    price_threshold: '',
    price_direction: 'below',
    currency: 'USD',
  });
  const [alertLocationSearch, setAlertLocationSearch] = useState('');
  const [locationSearchFocused, setLocationSearchFocused] = useState(false);
  const [alertLocationSearchFocused, setAlertLocationSearchFocused] = useState(false);

  // ScrollView refs for scrolling to inputs
  const locationFilterScrollRef = useRef<ScrollView>(null);
  const alertScrollRef = useRef<ScrollView>(null);

  // Chart interaction state
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);

  // V2-off filter state (Location + Year)
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [showYearFilter, setShowYearFilter] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]); // empty = worldwide (all)
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

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

  // V2-off local filters (Location + Year) applied on top of context filters
  // EU country codes for the EU location filter
  const EU_COUNTRY_CODES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB', 'NO'];

  // All countries A-Z for location search
  const ALL_COUNTRIES: { code: string; name: string }[] = useMemo(() => [
    { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
    { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BH', name: 'Bahrain' },
    { code: 'BD', name: 'Bangladesh' }, { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' },
    { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BR', name: 'Brazil' }, { code: 'BN', name: 'Brunei' },
    { code: 'BG', name: 'Bulgaria' }, { code: 'KH', name: 'Cambodia' }, { code: 'CA', name: 'Canada' },
    { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' }, { code: 'CO', name: 'Colombia' },
    { code: 'HR', name: 'Croatia' }, { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' },
    { code: 'DK', name: 'Denmark' }, { code: 'EG', name: 'Egypt' }, { code: 'EE', name: 'Estonia' },
    { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GE', name: 'Georgia' },
    { code: 'DE', name: 'Germany' }, { code: 'GR', name: 'Greece' }, { code: 'HK', name: 'Hong Kong' },
    { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' }, { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' },
    { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' },
    { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' },
    { code: 'KW', name: 'Kuwait' }, { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' },
    { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macau' },
    { code: 'MY', name: 'Malaysia' }, { code: 'MT', name: 'Malta' }, { code: 'MX', name: 'Mexico' },
    { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' }, { code: 'MA', name: 'Morocco' },
    { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' }, { code: 'NG', name: 'Nigeria' },
    { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' },
    { code: 'PA', name: 'Panama' }, { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russia' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'RS', name: 'Serbia' },
    { code: 'SG', name: 'Singapore' }, { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' },
    { code: 'ZA', name: 'South Africa' }, { code: 'KR', name: 'South Korea' }, { code: 'ES', name: 'Spain' },
    { code: 'LK', name: 'Sri Lanka' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
    { code: 'TW', name: 'Taiwan' }, { code: 'TH', name: 'Thailand' }, { code: 'TR', name: 'Turkey' },
    { code: 'UA', name: 'Ukraine' }, { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
    { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' }, { code: 'VN', name: 'Vietnam' },
  ], []);

  const matchesLocationFilter = (countryCode: string | undefined) => {
    if (selectedLocations.length === 0) return true;
    const code = countryCode?.toUpperCase();
    if (!code) return false;
    return selectedLocations.some(loc => {
      if (loc === 'EU') return EU_COUNTRY_CODES.includes(code);
      return code === loc;
    });
  };

  const v2OffFilteredBuyOrders = useMemo(() => {
    if (v2Enabled) return filteredBuyOrders;
    return filteredBuyOrders.filter(order => {
      if (!matchesLocationFilter(order.country_code)) return false;
      if (selectedYears.length > 0 || selectedMonths.length > 0) {
        // Order.date can be MM/YY (e.g. "03/26"), bare year ("2025", "2025+"),
        // or "-" for missing. Extract month (optional) and year.
        const raw = order.date || '';
        let orderMonth: number | null = null;
        let orderYear: number | null = null;
        const mmYy = raw.match(/^(\d{1,2})\/(\d{2})\+?$/);
        const bareYear = raw.match(/^(\d{4})\+?$/);
        if (mmYy) {
          orderMonth = parseInt(mmYy[1], 10);
          orderYear = 2000 + parseInt(mmYy[2], 10);
        } else if (bareYear) {
          orderYear = parseInt(bareYear[1], 10);
        }
        // Year constraint: require the order to have a year AND match selection.
        if (selectedYears.length > 0) {
          if (orderYear == null || !selectedYears.includes(orderYear)) return false;
        }
        // Month constraint: only filters rows that have a month. Bare-year rows
        // bypass this (no month to compare) so they still appear under a year
        // filter without a month selection.
        if (selectedMonths.length > 0) {
          if (orderMonth == null || !selectedMonths.includes(orderMonth)) return false;
        }
      }
      return true;
    });
  }, [filteredBuyOrders, v2Enabled, selectedLocations, selectedYears, selectedMonths]);

  const v2OffFilteredSellOrders = useMemo(() => {
    if (v2Enabled) return filteredSellOrders;
    return filteredSellOrders.filter(order => {
      if (!matchesLocationFilter(order.country_code)) return false;
      if (selectedYears.length > 0 || selectedMonths.length > 0) {
        // Order.date can be MM/YY (e.g. "03/26"), bare year ("2025", "2025+"),
        // or "-" for missing. Extract month (optional) and year.
        const raw = order.date || '';
        let orderMonth: number | null = null;
        let orderYear: number | null = null;
        const mmYy = raw.match(/^(\d{1,2})\/(\d{2})\+?$/);
        const bareYear = raw.match(/^(\d{4})\+?$/);
        if (mmYy) {
          orderMonth = parseInt(mmYy[1], 10);
          orderYear = 2000 + parseInt(mmYy[2], 10);
        } else if (bareYear) {
          orderYear = parseInt(bareYear[1], 10);
        }
        // Year constraint: require the order to have a year AND match selection.
        if (selectedYears.length > 0) {
          if (orderYear == null || !selectedYears.includes(orderYear)) return false;
        }
        // Month constraint: only filters rows that have a month. Bare-year rows
        // bypass this (no month to compare) so they still appear under a year
        // filter without a month selection.
        if (selectedMonths.length > 0) {
          if (orderMonth == null || !selectedMonths.includes(orderMonth)) return false;
        }
      }
      return true;
    });
  }, [filteredSellOrders, v2Enabled, selectedLocations, selectedYears, selectedMonths]);  // Derive "other" locations from order data (not in main list)
  const MAIN_LOCATION_CODES = ['AE', 'US', 'HK', 'GB', 'CH', 'CN'];
  const otherLocations = useMemo(() => {
    const allOrders = [...buyOrders, ...sellOrders];
    const locationMap = new Map<string, string>();
    allOrders.forEach(o => {
      const code = o.country_code?.toUpperCase();
      if (code && !locationMap.has(code) && !MAIN_LOCATION_CODES.includes(code) && !EU_COUNTRY_CODES.includes(code)) {
        locationMap.set(code, o.country_name || code);
      }
    });
    const result: { code: string; name: string }[] = [];
    locationMap.forEach((name, code) => result.push({ code, name }));
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [buyOrders, sellOrders]);

  const handleWhatsAppChat = useCallback((order: OrderBookItem) => {
    if (!order.whatsapp_phone) return;
    const watchName = `${watch?.brand || ''} ${watch?.model || ''}`.trim();
    const watchRef = watch?.reference || '';
    const orderCurrency = order.currency || watch.currency || 'EUR';
    const priceText = order.price != null
      ? `\n${orderCurrency} ${order.price.toLocaleString('de-DE')} - thank you very much!`
      : '';
    const message = `Hi, is ${watchName} ${watchRef} available?${priceText}`;
    const url = `https://wa.me/${order.whatsapp_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp. Make sure it is installed.');
    });
  }, [watch]);

  // Real price history from sell orders (fetched from backend)
  const [fullPriceHistory, setFullPriceHistory] = useState<{ date: string; price: number }[]>([]);

  // Slice price history based on selected time period
  const getDaysForPeriod = useCallback((period: string): number => {
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
    if (fullPriceHistory.length === 0) return [];
    const days = getDaysForPeriod(selectedPeriod);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const filtered = fullPriceHistory.filter(p => p.date >= cutoffStr);
    // Return just the prices for the chart component
    return filtered.map(p => p.price);
  }, [fullPriceHistory, selectedPeriod, getDaysForPeriod]);

  const loadPriceHistory = async () => {
    if (isGuideActive) return;
    const watchReference = wsCodeParam || reference || id;
    if (!watchReference) return;
    try {
      const encodedRef = encodeURIComponent(watchReference);
      const response = await api.get(`/orders/price-history/${encodedRef}?days=365`);
      if (response.data?.points) {
        setFullPriceHistory(response.data.points);
      }
    } catch (error) {
      console.log('Could not load price history');
    }
  };

  useEffect(() => {
    loadWatchDetails();
    loadOrderBook();
    loadPriceHistory();
  }, [id, reference]);

  // Reload data when screen comes into focus (e.g., after creating an order)
  useFocusEffect(
    useCallback(() => {
      loadWatchDetails();
      loadOrderBook();
      loadPriceHistory();
    }, [id, reference])
  );

  // Check watchlist status when authentication changes or reference changes
  useEffect(() => {
    checkWatchlistStatus();
  }, [id, reference, isAuthenticated]);

  // Fetch watch alert config
  const fetchAlerts = async () => {
    if (!watch?.ws_code) return;
    try {
      const res = await api.get(`/watch-alerts/${encodeURIComponent(watch.ws_code)}`);
      // Handle both old (single object/null) and new (array) backend response
      if (Array.isArray(res.data)) {
        setWatchAlerts(res.data);
      } else if (res.data && res.data.id) {
        setWatchAlerts([res.data]);
      } else {
        setWatchAlerts([]);
      }
    } catch {
      setWatchAlerts([]);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [watch?.ws_code]);

  const checkWatchlistStatus = async () => {
    if (isGuideActive) return;
    if (!isAuthenticated) return;

    // If navigated from default watchlist (not user's watchlist), don't show as saved
    // User needs to explicitly add it to their watchlist
    if (fromUserWatchlist === 'false') {
      setIsInWatchlist(false);
      return;
    }

    try {
      const response = await api.get('/profile/watchlist');
      if (response.data && Array.isArray(response.data)) {
        const watchWsCode = wsCodeParam || watch.ws_code;
        const watchReference = reference || id;
        const isInList = response.data.some((item: any) =>
          item.ws_code === watchWsCode
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

    const watchWsCode = wsCodeParam || watch.ws_code || '';
    const ref = reference || watch.reference || id || '';

    const wasInWatchlist = isInWatchlist;
    // Optimistic update — toggle immediately for responsive UI
    setIsInWatchlist(!wasInWatchlist);
    setWatchlistLoading(true);
    try {
      if (wasInWatchlist) {
        // Remove from watchlist — try ws_code first, fall back to reference for old records
        try {
          await api.delete(`/profile/watchlist/${encodeURIComponent(watchWsCode)}`);
        } catch {
          await api.delete(`/profile/watchlist/${encodeURIComponent(ref)}`);
        }
      } else {
        // Add to watchlist
        await api.post('/profile/watchlist', {
          brand: watch.brand || brand,
          model: watch.model || model,
          reference: ref,
          ws_code: watchWsCode,
          watch_id: id,
        });
      }
    } catch (error) {
      // Revert on failure
      setIsInWatchlist(wasInWatchlist);
      console.error('Failed to update watchlist:', error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const defaultAlertConfig = { notify_wts: false, notify_wtb: false, target_month: '', target_year: '', year_direction: 'exactly', condition: 'any', locations: [] as string[], price_threshold: '', price_direction: 'below', currency: 'USD' };

  const handleSaveAlert = async () => {
    if (!watch?.ws_code) return;
    setAlertLoading(true);
    try {
      const payload = {
        ws_code: watch.ws_code,
        notify_wts: alertConfig.notify_wts,
        notify_wtb: alertConfig.notify_wtb,
        target_month: alertConfig.target_month ? parseInt(alertConfig.target_month) : null,
        target_year: alertConfig.target_year ? parseInt(alertConfig.target_year) : null,
        year_direction: alertConfig.year_direction,
        condition: alertConfig.condition,
        locations: alertConfig.locations,
        price_threshold: alertConfig.price_threshold ? parseFloat(alertConfig.price_threshold) : null,
        price_direction: alertConfig.price_direction,
        currency: alertConfig.currency,
      };
      if (editingAlertId) {
        // Try new PUT endpoint; fall back to POST (old backend does upsert)
        try {
          await api.put(`/watch-alerts/${editingAlertId}`, payload);
        } catch {
          await api.post('/watch-alerts', payload);
        }
      } else {
        await api.post('/watch-alerts', payload);
      }
      await fetchAlerts();
      setAlertListMode(true);
      setEditingAlertId(null);
    } catch (error) {
      console.error('Failed to save alert:', error);
    } finally {
      setAlertLoading(false);
    }
  };

  const handleRemoveAlert = async () => {
    if (!editingAlertId || !watch?.ws_code) return;
    setAlertLoading(true);
    try {
      // Try new endpoint (delete by ID); fall back to old (delete by ws_code)
      try {
        await api.delete(`/watch-alerts/${editingAlertId}`);
      } catch {
        await api.delete(`/watch-alerts/${encodeURIComponent(watch.ws_code)}`);
      }
      await fetchAlerts();
      setEditingAlertId(null);
      setAlertConfig(defaultAlertConfig);
      setAlertListMode(true);
    } catch (error) {
      console.error('Failed to remove alert:', error);
    } finally {
      setAlertLoading(false);
    }
  };

  const openAlertForEdit = (alert: any) => {
    setEditingAlertId(alert.id);
    setAlertConfig({
      notify_wts: alert.notify_wts,
      notify_wtb: alert.notify_wtb,
      target_month: alert.target_month ? String(alert.target_month) : '',
      target_year: alert.target_year ? String(alert.target_year) : '',
      year_direction: alert.year_direction || 'exactly',
      condition: alert.condition || 'any',
      locations: alert.locations || [],
      price_threshold: alert.price_threshold ? String(alert.price_threshold) : '',
      price_direction: alert.price_direction || 'below',
      currency: alert.currency || 'USD',
    });
    setAlertListMode(false);
  };

  const openNewAlert = () => {
    setEditingAlertId(null);
    setAlertConfig(defaultAlertConfig);
    setAlertListMode(false);
  };

  const loadWatchDetails = async () => {
    if (isGuideActive) { setWatch(GUIDE_MOCK_WATCH_DETAILS); setLoading(false); return; }
    try {
      // Use ws_code first (unique per variant), then reference, then id
      const watchIdentifier = wsCodeParam || reference || '';

      if (watchIdentifier) {
        // Encode to handle special characters in URLs (e.g., 5711/1A-010)
        const encodedReference = encodeURIComponent(watchIdentifier);

        // Try aggregated endpoint — backend tries ws_code first, then reference
        const response = await api.get(`/market/aggregated/${encodedReference}`);
        if (response.data) {
          const data = response.data;
          setWatch({
            id: data.reference, // Use reference as ID for aggregated data
            brand: data.brand,
            model: data.model,
            reference: data.reference || '',
            ws_code: data.ws_code,
            image: data.cover_image,
            currency: data.currency || 'EUR',
            marketPriceMin: data.lowest_order_price || data.admin_price || 0,
            marketPriceMax: data.admin_price || data.display_price || 0,
            priceChange: data.price_change || 0,
            bestBid: 0, // Will be populated from order book
            bestAsk: data.lowest_order_price || 0,
            spread: 0,
            priceHistory: data.price_history || [],
            wtsCount: data.wts_count || 0,
            wtbCount: data.wtb_count || 0,
          });
          return; // Success, exit early
        }
      }

      // If no reference or aggregated lookup failed, try by ID
      // Only try this if id looks like it could be a valid MongoDB ObjectId or watch reference
      if (id) {
        const encodedId = encodeURIComponent(id);
        const response = await api.get(`/market/watches/${encodedId}`);
        if (response.data) {
          setWatch({
            id: response.data.id,
            brand: response.data.brand,
            model: response.data.model,
            reference: response.data.reference || '',
            ws_code: response.data.ws_code,
            image: response.data.cover_image,
            currency: response.data.currency || 'EUR',
            marketPriceMin: response.data.price || 0,
            marketPriceMax: response.data.price || 0,
            priceChange: response.data.price_change || 0,
            bestBid: 0,
            bestAsk: response.data.price || 0,
            spread: 0,
            priceHistory: response.data.price_history || [],
          });
        }
      }
    } catch (error) {
      // If all lookups fail, use the passed brand/model params if available
      // This handles default watchlist items that don't have a matching Watch document
      if (brand && model) {
        setWatch({
          id: id || '',
          brand: brand,
          model: model,
          reference: reference || '',
          ws_code: wsCodeParam || undefined,
          image: undefined,
          currency: 'EUR',
          marketPriceMin: 0,
          marketPriceMax: 0,
          priceChange: 0,
          bestBid: 0,
          bestAsk: 0,
          spread: 0,
          priceHistory: [],
        });
      } else {
        console.error('Failed to load watch details');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadOrderBook = async () => {
    if (isGuideActive) { setBuyOrders(GUIDE_MOCK_BUY_ORDERS); setSellOrders(GUIDE_MOCK_SELL_ORDERS); return; }
    try {
      const watchReference = wsCodeParam || reference || id;
      // Encode the reference to handle special characters in URLs (e.g., 5711/1A-010)
      const encodedReference = encodeURIComponent(watchReference || '');
      const response = await api.get(`/orders/book/${encodedReference}`, {
        params: { limit: 5000 }
      });
      if (response.data) {
        const { buy_orders, sell_orders } = response.data;

        // Helper to format date safely - show MM/YY format (e.g., "02/26")
        const formatOrderDate = (dateStr: string | undefined) => {
          if (!dateStr) return '-';
          // Bare 4-digit year (e.g., "2022") — show as-is (no month fabrication)
          if (/^\d{4}\+?$/.test(dateStr)) return dateStr;
          // MM.DD.YY format from backend
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            return `${parts[0]}/${parts[2]}`;
          }
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear().toString().slice(-2);
          return `${month}/${year}`;
        };

        // Transform buy orders
        const formattedBuyOrders: OrderBookItem[] = (buy_orders || []).map((order: any) => ({
          id: order.id,
          country_code: order.country_code || 'us',
          country_name: order.country_name,
          date: formatOrderDate(order.date),
          condition: order.condition || '',
          price: order.price,
          currency: order.currency || 'EUR',
          has_box: order.has_box,
          has_papers: order.has_papers,
          user_id: order.user_id,
          user_name: order.user_name,
          whatsapp_phone: order.whatsapp_phone,
          remarks: order.remarks,
          created_at: order.created_at,
        }));

        // Transform sell orders
        const formattedSellOrders: OrderBookItem[] = (sell_orders || []).map((order: any) => ({
          id: order.id,
          country_code: order.country_code || 'us',
          country_name: order.country_name,
          date: formatOrderDate(order.date),
          condition: order.condition || '',
          price: order.price,
          currency: order.currency || 'EUR',
          has_box: order.has_box,
          has_papers: order.has_papers,
          user_id: order.user_id,
          user_name: order.user_name,
          whatsapp_phone: order.whatsapp_phone,
          remarks: order.remarks,
          created_at: order.created_at,
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
          // Find the lowest-priced sell order to get its currency
          const lowestSellOrder = formattedSellOrders.reduce((min, o) => o.price < min.price ? o : min, formattedSellOrders[0]);
          setWatch(prev => ({
            ...prev,
            bestAsk: lowestSellOrder.price,
            currency: lowestSellOrder.currency || prev.currency,
            marketPriceMin: lowestSellOrder.price,
            spread: prev.bestBid ? lowestSellOrder.price - prev.bestBid : 0,
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

  // Currency-aware formatting helpers
  const currencyPrefix = watch.currency !== 'EUR' ? `${watch.currency} ` : '€';

  // Stats format: symbol AFTER number with period as thousands separator (e.g., "104.500€" or "HKD 104.500")
  // Returns "-" for 0, null, or undefined values
  const formatPriceEurAfter = (price: number | null | undefined) => {
    if (price == null || price === 0) return '-';
    if (watch.currency !== 'EUR') return `${watch.currency} ${price.toLocaleString('de-DE')}`;
    return `${price.toLocaleString('de-DE')}€`;
  };

  // Price format: symbol BEFORE number (e.g., "€104,500" or "HKD 104,500")
  const formatPriceEurBefore = (price: number | null | undefined) => {
    if (price == null) return '-';
    return `${currencyPrefix}${price.toLocaleString('de-DE')}`;
  };

  // Market price range format (e.g., "€51,000 - €156,460" or "HKD 51,000 - HKD 156,460")
  const formatPriceRange = (min: number, max: number) => {
    if (min === max || !max || !min) {
      return `${currencyPrefix}${(min || max).toLocaleString('de-DE')}`;
    }
    return `${currencyPrefix}${min.toLocaleString('de-DE')} - ${currencyPrefix}${max.toLocaleString('de-DE')}`;
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

  // Handle submitting the offer - navigate to create listing page with buy order
  const handleSubmitOffer = useCallback(() => {
    if (!offerAmount) return;

    // Close modal
    setShowMakeOfferModal(false);

    // Parse the price from formatted string (remove thousand separators)
    const priceValue = offerAmount.replace(/\./g, '');

    // Navigate to create listing page with buy order parameters
    router.push({
      pathname: '/listing/create',
      params: {
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        price: priceValue,
        orderType: 'buy',
      },
    });
  }, [offerAmount, watch]);

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
          {/* Gray gradient background */}
          <LinearGradient
            colors={['#FAFAFA', '#F0F0F0']}
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
              <Text style={styles.headerSubtitle}>{watch.ws_code || wsCodeParam || watch.reference}</Text>
            </View>
          </SafeAreaView>

          {/* Price Info - inside hero container so gray bg extends behind it */}
          <View style={styles.priceSection}>
            {v2Enabled ? (
              <>
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
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(8) }}>
                  <View style={{ backgroundColor: 'rgba(74,160,120,0.1)', paddingHorizontal: wp(12), paddingVertical: hp(6), borderRadius: sp(99) }}>
                    <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(14), color: '#4AA078' }}>WTS {watch.wtsCount ?? sellOrders.length}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(91,155,213,0.1)', paddingHorizontal: wp(12), paddingVertical: hp(6), borderRadius: sp(99) }}>
                    <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(14), color: '#5B9BD5' }}>WTB {watch.wtbCount ?? buyOrders.length}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>


        {/* Action Buttons */}
        {v2Enabled && <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: '/market/order-book',
              params: {
                reference: watch.ws_code || watch.reference,
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
              <StarIcon key={isInWatchlist ? 'filled' : 'empty'} filled={isInWatchlist} />
            </View>
            <Text style={styles.actionLabel}>{isInWatchlist ? 'Saved' : 'Watchlist'}</Text>
          </TouchableOpacity>
          {v2Enabled && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/social-search')}
            >
              <View style={styles.actionIconContainer}>
                <SocialSearchIcon />
              </View>
              <Text style={styles.actionLabel}>Social Search</Text>
            </TouchableOpacity>
          )}
        </View>}

        {/* V2-Off Filters (Location + Year) */}
        {!v2Enabled && (
          <View style={styles.v2OffFiltersSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.v2OffFiltersRow}>
                <TouchableOpacity
                  style={[styles.v2OffFilterButton, selectedLocations.length > 0 && styles.v2OffFilterButtonActive]}
                  onPress={() => setShowLocationFilter(true)}
                >
                  <Text style={[styles.v2OffFilterButtonText, selectedLocations.length > 0 && styles.v2OffFilterButtonTextActive]}>
                    {selectedLocations.length > 0 ? selectedLocations.map(c => ({ EU: 'EU', AE: 'UAE', US: 'US', HK: 'HK', GB: 'UK' }[c] || c)).join(', ') : 'Location'}
                  </Text>
                  {selectedLocations.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedLocations([])}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                        <Path d="M4 4L12 12M12 4L4 12" stroke="#212121" strokeWidth={1.5} strokeLinecap="round" />
                      </Svg>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.v2OffFilterButton, (selectedYears.length > 0 || selectedMonths.length > 0) && styles.v2OffFilterButtonActive]}
                  onPress={() => setShowYearFilter(true)}
                >
                  <Text style={[styles.v2OffFilterButtonText, (selectedYears.length > 0 || selectedMonths.length > 0) && styles.v2OffFilterButtonTextActive]}>
                    {selectedYears.length > 0 || selectedMonths.length > 0
                      ? `${selectedMonths.length > 0 ? selectedMonths.map(m => String(m).padStart(2, '0')).join(',') + '/' : ''}${selectedYears.length > 0 ? selectedYears.join(',') : 'All'}`
                      : 'Year'}
                  </Text>
                  {(selectedYears.length > 0 || selectedMonths.length > 0) && (
                    <TouchableOpacity
                      onPress={() => { setSelectedYears([]); setSelectedMonths([]); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                        <Path d="M4 4L12 12M12 4L4 12" stroke="#212121" strokeWidth={1.5} strokeLinecap="round" />
                      </Svg>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </ScrollView>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(12), marginLeft: wp(10) }}>
                <TouchableOpacity
                  onPress={() => { setAlertListMode(watchAlerts.length > 0); if (watchAlerts.length === 0) openNewAlert(); setShowAlertModal(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill={watchAlerts.length > 0 ? '#212121' : 'none'}>
                    <Path
                      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                      stroke="#212121"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleWatchlist}
                  disabled={watchlistLoading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <StarIcon filled={isInWatchlist} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Market Section */}
        {v2Enabled && <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market</Text>

          {/* Bid/Ask/Spread - € AFTER number per Figma */}
          {v2Enabled && (
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
          )}

          {/* Price tooltip - shows selected chart point or latest order book data */}
          {(filteredPriceHistory.length > 0 || sellOrders.length > 0 || buyOrders.length > 0) && (
            <View style={styles.priceTooltip}>
              <Text style={styles.tooltipPrice}>
                {(() => {
                  // If a chart point is selected, show that price
                  if (selectedChartIndex !== null && filteredPriceHistory[selectedChartIndex] !== undefined) {
                    return formatPriceEurBefore(filteredPriceHistory[selectedChartIndex]);
                  }
                  // Otherwise show latest order book price (using order's own currency)
                  if (sellOrders.length > 0 && sellOrders[0].price != null) {
                    const o = sellOrders[0];
                    const prefix = o.currency && o.currency !== 'EUR' ? `${o.currency} ` : '€';
                    return `${prefix}${o.price.toLocaleString('de-DE')}`;
                  }
                  if (buyOrders.length > 0 && buyOrders[0].price != null) {
                    const o = buyOrders[0];
                    const prefix = o.currency && o.currency !== 'EUR' ? `${o.currency} ` : '€';
                    return `${prefix}${o.price.toLocaleString('de-DE')}`;
                  }
                  return formatPriceEurBefore(
                    filteredPriceHistory.length > 0
                      ? filteredPriceHistory[filteredPriceHistory.length - 1]
                      : 0
                  );
                })()}
              </Text>
              <Text style={styles.tooltipDate}>
                {(() => {
                  // If a chart point is selected, calculate and show that date
                  if (selectedChartIndex !== null && filteredPriceHistory.length > 0) {
                    // Calculate the date based on index and selected period
                    const today = new Date();
                    const totalDays = (() => {
                      switch (selectedPeriod) {
                        case '1d': return 1;
                        case '7d': return 7;
                        case '1m': return 30;
                        case '3m': return 90;
                        case '1y': return 365;
                        default: return 30;
                      }
                    })();
                    // Calculate how many days ago this point represents
                    const daysAgo = totalDays - Math.round((selectedChartIndex / (filteredPriceHistory.length - 1)) * totalDays);
                    const pointDate = new Date(today);
                    pointDate.setDate(today.getDate() - daysAgo);
                    return pointDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }).toUpperCase().replace(',', '.');
                  }
                  // Otherwise show latest order book date
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
              selectedIndex={selectedChartIndex}
              onSelectIndex={setSelectedChartIndex}
            />
          </View>

          {/* Time period selector */}
          <View style={styles.periodSelector}>
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
                onPress={() => {
                  setSelectedPeriod(period);
                  setSelectedChartIndex(null); // Reset selection when period changes
                }}
              >
                <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>}

        {/* Order Book Section */}
        <View style={styles.section}>
          {v2Enabled && <Text style={styles.sectionTitle}>Order Book</Text>}

          {/* Tab Selector */}
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

          {/* Order Book Table */}
          {(() => {
            const currentOrders = selectedTab === 'Buy' ? v2OffFilteredBuyOrders : v2OffFilteredSellOrders;
            const hasRemarks = !v2Enabled;
            return (<View style={styles.orderBookTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: v2Enabled ? 1 : 0.8, textAlign: 'center' }]}>{v2Enabled ? 'Market' : 'Location'}</Text>
              <Text style={[styles.tableHeaderCell, { flex: v2Enabled ? 1 : 0.8, textAlign: 'center' }]}>Details</Text>
              {hasRemarks && <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Remarks</Text>}
              <Text style={[styles.tableHeaderCell, { flex: v2Enabled ? 1 : 1, textAlign: 'center' }]}>{!v2Enabled && selectedTab === 'Buy' ? 'Target' : 'Price'}</Text>
              <Text style={[styles.tableHeaderCell, { flex: v2Enabled ? 0.7 : 0.5, textAlign: 'center' }]}>Chat</Text>
            </View>

            {/* Rows - use dynamic data from API with filters applied */}
            {currentOrders.length === 0 ? (
              <View style={styles.orderBookEmptyState}>
                <Text style={styles.orderBookEmptyText}>
                  No {selectedTab.toLowerCase()} orders available for this watch
                </Text>
              </View>
            ) : (
              (v2Enabled ? currentOrders.slice(0, 5) : currentOrders).map((order, index) => (
                <View
                  key={index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
                >
                  <View style={[styles.tableCell, { flex: v2Enabled ? 1 : 0.8, alignItems: 'center' }]}>
                    <CountryFlag countryCode={order.country_code} size={14} />
                    <Text style={[styles.tableCellText, { fontSize: fp(11), textAlign: 'center', marginTop: hp(2), color: v2Enabled ? '#212121' : '#999999' }]}>
                      {v2Enabled ? order.country_code?.toUpperCase() : (order.country_name || order.country_code?.toUpperCase())}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, { flex: v2Enabled ? 1 : 0.8, alignItems: 'center' }]}>
                    <Text style={[styles.tableCellText, { textAlign: 'center' }]}>{order.condition}</Text>
                    <Text style={[styles.tableCellText, { textAlign: 'center', fontSize: fp(11), color: '#999999' }]}>{order.date}</Text>
                  </View>
                  {hasRemarks && (
                    <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center' }]}>
                      {order.remarks ? (() => {
                        const parts = order.remarks.split(/\s*;\s*/).filter(Boolean);
                        const isMulti = parts.length > 1;
                        let seeAllRef: any = null;
                        return (
                          <View style={{ alignItems: 'center' }}>
                            <View style={{ backgroundColor: 'rgba(33,33,33,0.06)', paddingHorizontal: wp(6), paddingVertical: hp(2), borderRadius: sp(6) }}>
                              <Text style={[styles.tableCellText, { textAlign: 'center', fontSize: fp(10), color: '#555555' }]} numberOfLines={2}>
                                {parts[0]}
                              </Text>
                            </View>
                            {isMulti && (
                              <TouchableOpacity
                                ref={(r) => { seeAllRef = r; }}
                                onPress={() => {
                                  if (seeAllRef && typeof seeAllRef.measureInWindow === 'function') {
                                    seeAllRef.measureInWindow((x: number, y: number, w: number, h: number) => {
                                      setRemarksBubbleSize(null);
                                      setRemarksBubble({ text: order.remarks!, anchorX: x, anchorY: y, anchorWidth: w, anchorHeight: h });
                                    });
                                  } else {
                                    setRemarksBubbleSize(null);
                                    setRemarksBubble({ text: order.remarks!, anchorX: 0, anchorY: 0, anchorWidth: 0, anchorHeight: 0 });
                                  }
                                }}
                                activeOpacity={0.6}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                style={{ marginTop: hp(3) }}
                              >
                                <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(10), color: '#5B9BD5' }}>
                                  See all (+{parts.length - 1})
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })() : (
                        <Text style={[styles.tableCellText, { textAlign: 'center', fontSize: fp(11), color: '#CCCCCC' }]}>-</Text>
                      )}
                    </View>
                  )}
                  <View style={[styles.tableCell, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}>
                    {order.price == null ? (
                      <Text style={[styles.tableCellText, { textAlign: 'center', fontSize: fp(11), color: '#CCCCCC' }]}>-</Text>
                    ) : (
                      <Text style={[styles.tableCellTextBold, { textAlign: 'center' }]}>
                        {order.currency && order.currency !== 'EUR'
                          ? `${order.currency} ${order.price.toLocaleString('de-DE')}`
                          : formatPriceEurBefore(order.price)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: v2Enabled ? 0.7 : 0.5, alignItems: 'center', justifyContent: 'center', paddingVertical: hp(6) }}>
                    <TouchableOpacity
                      onPress={() => handleWhatsAppChat(order)}
                      disabled={!order.whatsapp_phone}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <WhatsAppIcon size={18} />
                    </TouchableOpacity>
                    {!v2Enabled && order.created_at && (() => {
                      const daysAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
                      const dotColor = daysAgo <= 7 ? '#4AA078' : daysAgo <= 14 ? '#E8A838' : '#D35741';
                      const label = daysAgo === 0 ? 'today' : `${daysAgo}d`;
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(3), marginTop: hp(4) }}>
                          <View style={{ width: sp(6), height: sp(6), borderRadius: sp(3), backgroundColor: dotColor }} />
                          <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(9), color: dotColor }}>{label}</Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              ))
            )}
          </View>); })()}

          {/* See Order Book Button */}
          {v2Enabled && (
            <TouchableOpacity
              style={styles.seeOrderBookButton}
              onPress={() => router.push({
                pathname: '/market/order-book',
                params: {
                  reference: watch.ws_code || watch.reference,
                  brand: watch.brand,
                  model: watch.model,
                },
              })}
            >
              <Text style={styles.seeOrderBookText}>See Order Book</Text>
              <ArrowRightIcon />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom spacing for action bar */}
        <View style={{ height: hp(120) }} />
      </ScrollView>

      {/* Bottom Action Bar with gradient fade */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF']}
        locations={[0, 0.55]}
        style={[styles.bottomBar, !v2Enabled && { paddingTop: hp(20), paddingBottom: hp(40) }]}
      >
        {v2Enabled ? (
          <View style={styles.bottomBarContent}>
            <View style={styles.orderButtons}>
              <TouchableOpacity style={styles.buyButton} onPress={handlePlaceBuyOrder}>
                <Text style={styles.orderButtonText} numberOfLines={1}>Place Buy Order</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sellButton} onPress={handlePlaceSellOrder}>
                <Text style={styles.orderButtonText} numberOfLines={1}>Place Sell Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ height: sp(42) }} />
        )}
        <TouchableOpacity style={styles.aiButtonOuter} onPress={() => router.push('/chat/ai')}>
          <View style={styles.aiButtonInner}>
            <SparkleIcon />
          </View>
        </TouchableOpacity>
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
                    <Text style={styles.offerInputCurrency}>{watch.currency === 'EUR' ? '€' : watch.currency}</Text>
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
                    <LoadingAnimation size="small" />
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
                <Text style={styles.offerSubmittedAmount}>{watch.currency === 'EUR' ? '€' : watch.currency + ' '}{submittedOfferAmount}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location Filter Modal */}
      <Modal
        visible={showLocationFilter}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowLocationFilter(false); setLocationSearchQuery(''); setLocationSearchFocused(false); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(16), paddingVertical: hp(12), borderBottomWidth: 1, borderBottomColor: '#F0F0F0', position: 'relative' }}>
            <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(18), color: '#212121' }}>Location</Text>
            <TouchableOpacity onPress={() => { setShowLocationFilter(false); setLocationSearchQuery(''); setLocationSearchFocused(false); }} style={{ position: 'absolute', right: wp(16), padding: hp(8) }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Selected location chips */}
          {selectedLocations.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: wp(6), paddingHorizontal: wp(20), paddingTop: hp(12), paddingBottom: hp(4) }}>
              {selectedLocations.map(code => {
                const country = ALL_COUNTRIES.find(c => c.code === code);
                const label = code === 'EU' ? 'EU' : (country?.name || code);
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => setSelectedLocations(prev => prev.filter(c => c !== code))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: wp(4), backgroundColor: '#F0F0F0', borderRadius: sp(99), paddingHorizontal: wp(10), paddingVertical: hp(5) }}
                  >
                    {code === 'EU' ? <Text style={{ fontSize: fp(13) }}>🇪🇺</Text> : <CountryFlag countryCode={code} size={13} />}
                    <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(12), color: '#212121' }}>{label}</Text>
                    <Svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                      <Path d="M4 4L12 12M12 4L4 12" stroke="#666" strokeWidth={1.5} strokeLinecap="round" />
                    </Svg>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Search input — pinned above list when focused */}
          {locationSearchFocused && (
            <View style={{ paddingHorizontal: wp(20), paddingVertical: hp(10) }}>
              <TextInput
                style={{ height: hp(40), borderWidth: 1, borderColor: '#E5E5E5', borderRadius: sp(10), paddingHorizontal: wp(12), fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}
                placeholder="Search country..."
                placeholderTextColor="#8E8E93"
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onBlur={() => { setLocationSearchFocused(false); setLocationSearchQuery(''); }}
              />
            </View>
          )}

          <ScrollView ref={locationFilterScrollRef} style={{ flex: 1, paddingHorizontal: wp(20) }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {locationSearchFocused ? (
              /* Search results */
              ALL_COUNTRIES
                .filter(c => locationSearchQuery.trim().length === 0 || c.name.toLowerCase().includes(locationSearchQuery.toLowerCase().trim()))
                .map((loc) => {
                  const isSelected = selectedLocations.includes(loc.code);
                  return (
                    <TouchableOpacity
                      key={loc.code}
                      style={styles.filterModalOption}
                      onPress={() => {
                        setSelectedLocations(prev =>
                          prev.includes(loc.code)
                            ? prev.filter(c => c !== loc.code)
                            : [...prev, loc.code]
                        );
                      }}
                    >
                      <CountryFlag countryCode={loc.code} size={20} />
                      <Text style={[styles.filterModalOptionText, isSelected && styles.filterModalOptionTextActive]}>{loc.name}</Text>
                      {isSelected && (
                        <View style={styles.filterModalCheckmark}>
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17L4 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
            ) : (
              /* Default locations list + search input at bottom */
              <>
                {[
                  { code: '', name: 'Worldwide', icon: '🌐' },
                  { code: 'EU', name: 'EU', icon: '🇪🇺' },
                  { code: 'HK', name: 'Hong Kong' },
                  { code: 'AE', name: 'United Arab Emirates' },
                  { code: 'GB', name: 'United Kingdom' },
                  { code: 'US', name: 'United States' },
                  { code: 'CH', name: 'Switzerland' },
                  { code: 'CN', name: 'China' },
                ].map((loc) => {
                  const isWorldwide = loc.code === '';
                  const isSelected = isWorldwide ? selectedLocations.length === 0 : selectedLocations.includes(loc.code);
                  return (
                    <TouchableOpacity
                      key={loc.code || 'worldwide'}
                      style={styles.filterModalOption}
                      onPress={() => {
                        if (isWorldwide) {
                          setSelectedLocations([]);
                        } else {
                          setSelectedLocations(prev =>
                            prev.includes(loc.code)
                              ? prev.filter(c => c !== loc.code)
                              : [...prev, loc.code]
                          );
                        }
                      }}
                    >
                      {loc.icon ? (
                        <Text style={styles.filterModalOptionIcon}>{loc.icon}</Text>
                      ) : (
                        <CountryFlag countryCode={loc.code} size={20} />
                      )}
                      <Text style={[styles.filterModalOptionText, isSelected && styles.filterModalOptionTextActive]}>{loc.name}</Text>
                      {isSelected && (
                        <View style={styles.filterModalCheckmark}>
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17L4 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Separator + Search input below China */}
                <View style={{ height: 1, backgroundColor: '#E5E5E5', marginVertical: hp(8) }} />
                <TouchableOpacity
                  style={{ height: hp(40), borderWidth: 1, borderColor: '#E5E5E5', borderRadius: sp(10), paddingHorizontal: wp(12), justifyContent: 'center' }}
                  onPress={() => setLocationSearchFocused(true)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#8E8E93' }}>Search country...</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {/* Apply button */}
          {!locationSearchFocused && (
            <View style={{ paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <TouchableOpacity
                style={{ backgroundColor: '#212121', borderRadius: sp(99), paddingVertical: hp(14), alignItems: 'center' }}
                onPress={() => { setShowLocationFilter(false); setLocationSearchQuery(''); setLocationSearchFocused(false); }}
              >
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#FFFFFF' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Watch Alert List Modal (compact bottom sheet) */}
      <Modal
        visible={showAlertModal && alertListMode}
        animationType="fade"
        transparent={true}
        onRequestClose={() => { setShowAlertModal(false); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          activeOpacity={1}
          onPress={() => setShowAlertModal(false)}
        >
          <View style={{ flex: 1 }} />
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <SafeAreaView style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: sp(16), borderTopRightRadius: sp(16) }} edges={['bottom']}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(16), paddingTop: hp(16), paddingBottom: hp(12), position: 'relative' }}>
                <View style={{ width: wp(36), height: hp(4), borderRadius: sp(2), backgroundColor: '#D1D1D6', position: 'absolute', top: hp(8) }} />
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(18), color: '#212121' }}>Price Alerts</Text>
                <TouchableOpacity onPress={() => setShowAlertModal(false)} style={{ position: 'absolute', right: wp(16), padding: hp(8) }}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              </View>

              {/* Alert cards */}
              <View style={{ paddingHorizontal: wp(16), paddingBottom: hp(8), gap: hp(10) }}>
                {watchAlerts.map((alert) => {
                  const typeLabel = alert.notify_wts ? 'WTS' : alert.notify_wtb ? 'WTB' : '';
                  const priceLabel = alert.price_threshold
                    ? `${alert.price_direction === 'below' ? 'Below' : 'Above'} ${Number(alert.price_threshold).toLocaleString()} ${alert.currency}`
                    : 'Any price';
                  const condLabel = alert.condition && alert.condition !== 'any' ? (alert.condition === 'unworn' ? 'Unworn' : 'Used') : '';
                  const locCount = alert.locations?.length || 0;
                  return (
                    <TouchableOpacity
                      key={alert.id}
                      onPress={() => openAlertForEdit(alert)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: sp(12), paddingHorizontal: wp(14), paddingVertical: hp(14) }}
                    >
                      <View style={{ flex: 1, gap: hp(4) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(8) }}>
                          {typeLabel ? (
                            <View style={{ backgroundColor: typeLabel === 'WTS' ? '#4AA078' : '#3B82F6', borderRadius: sp(6), paddingHorizontal: wp(8), paddingVertical: hp(2) }}>
                              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(12), color: '#FFF' }}>{typeLabel}</Text>
                            </View>
                          ) : null}
                          <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121', flex: 1 }}>{priceLabel}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(8) }}>
                          {condLabel ? <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(12), color: '#8E8E93' }}>{condLabel}</Text> : null}
                          {locCount > 0 ? <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(12), color: '#8E8E93' }}>{locCount} location{locCount > 1 ? 's' : ''}</Text> : null}
                        </View>
                      </View>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 18l6-6-6-6" stroke="#8E8E93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add button */}
              <View style={{ paddingHorizontal: wp(16), paddingTop: hp(8), paddingBottom: hp(16) }}>
                <TouchableOpacity
                  onPress={openNewAlert}
                  style={{ paddingVertical: hp(14), borderRadius: sp(99), backgroundColor: '#212121', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#FFFFFF' }}>Add New Alert</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Watch Alert Form Modal (full page sheet) */}
      <Modal
        visible={showAlertModal && !alertListMode}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowAlertModal(false); setAlertLocationSearch(''); setAlertLocationSearchFocused(false); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(16), paddingVertical: hp(12), borderBottomWidth: 1, borderBottomColor: '#F0F0F0', position: 'relative' }}>
            <TouchableOpacity onPress={() => { if (watchAlerts.length > 0) { setAlertListMode(true); setEditingAlertId(null); } else { setShowAlertModal(false); } setAlertLocationSearch(''); setAlertLocationSearchFocused(false); }} style={{ position: 'absolute', left: wp(16), padding: hp(8) }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#212121" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(18), color: '#212121' }}>
              {editingAlertId ? 'Edit Alert' : 'New Alert'}
            </Text>
            <TouchableOpacity onPress={() => { setShowAlertModal(false); setAlertLocationSearch(''); setAlertLocationSearchFocused(false); }} style={{ position: 'absolute', right: wp(16), padding: hp(8) }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView ref={alertScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
            {/* WTS / WTB Toggle — only one can be active */}
            <View style={{ paddingHorizontal: wp(16), paddingTop: hp(20), paddingBottom: hp(12) }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: hp(12) }}
                onPress={() => setAlertConfig(c => ({ ...c, notify_wts: !c.notify_wts, notify_wtb: !c.notify_wts ? false : c.notify_wtb }))}
              >
                <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(16), color: '#212121' }}>WTS Notifications</Text>
                <View style={{ width: wp(44), height: hp(24), borderRadius: sp(12), backgroundColor: alertConfig.notify_wts ? '#4AA078' : '#E5E5E5', justifyContent: 'center', paddingHorizontal: wp(2) }}>
                  <View style={{ width: wp(20), height: wp(20), borderRadius: wp(10), backgroundColor: '#FFF', alignSelf: alertConfig.notify_wts ? 'flex-end' : 'flex-start' }} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: hp(12) }}
                onPress={() => setAlertConfig(c => ({ ...c, notify_wtb: !c.notify_wtb, notify_wts: !c.notify_wtb ? false : c.notify_wts }))}
              >
                <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(16), color: '#212121' }}>WTB Notifications</Text>
                <View style={{ width: wp(44), height: hp(24), borderRadius: sp(12), backgroundColor: alertConfig.notify_wtb ? '#4AA078' : '#E5E5E5', justifyContent: 'center', paddingHorizontal: wp(2) }}>
                  <View style={{ width: wp(20), height: wp(20), borderRadius: wp(10), backgroundColor: '#FFF', alignSelf: alertConfig.notify_wtb ? 'flex-end' : 'flex-start' }} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Year Section — 3 columns: Direction | Month | Year */}
            <View style={{ paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#212121', marginBottom: hp(12) }}>Year</Text>
              <View style={{ flexDirection: 'row', gap: wp(12), height: hp(200) }}>
                {/* Direction column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Direction</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {([{ key: 'exactly', label: '= Exactly' }, { key: 'older', label: '↓ Older' }, { key: 'newer', label: '↑ Newer' }] as const).map(dir => (
                      <TouchableOpacity
                        key={dir.key}
                        onPress={() => setAlertConfig(c => ({ ...c, year_direction: dir.key }))}
                        style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: alertConfig.year_direction === dir.key ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                      >
                        <Text style={{ fontFamily: alertConfig.year_direction === dir.key ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{dir.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {/* Month column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Month</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <TouchableOpacity
                      onPress={() => setAlertConfig(c => ({ ...c, target_month: '' }))}
                      style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: !alertConfig.target_month ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                    >
                      <Text style={{ fontFamily: !alertConfig.target_month ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>Any</Text>
                    </TouchableOpacity>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setAlertConfig(c => ({ ...c, target_month: String(m) }))}
                        style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: alertConfig.target_month === String(m) ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                      >
                        <Text style={{ fontFamily: alertConfig.target_month === String(m) ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {/* Year column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Year</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <TouchableOpacity
                      onPress={() => setAlertConfig(c => ({ ...c, target_year: '' }))}
                      style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: !alertConfig.target_year ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                    >
                      <Text style={{ fontFamily: !alertConfig.target_year ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>Any</Text>
                    </TouchableOpacity>
                    {Array.from({ length: 16 }, (_, i) => String(2026 - i)).map(y => (
                      <TouchableOpacity
                        key={y}
                        onPress={() => setAlertConfig(c => ({ ...c, target_year: y }))}
                        style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: alertConfig.target_year === y ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                      >
                        <Text style={{ fontFamily: alertConfig.target_year === y ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* Condition */}
            <View style={{ paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#212121', marginBottom: hp(12) }}>Condition</Text>
              <View style={{ flexDirection: 'row', gap: wp(8) }}>
                {([{ key: 'any', label: 'Any' }, { key: 'unworn', label: 'Only Unworn' }, { key: 'used', label: 'Only Used' }] as const).map(item => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setAlertConfig(c => ({ ...c, condition: item.key }))}
                    style={{ paddingHorizontal: wp(16), paddingVertical: hp(10), borderRadius: sp(99), backgroundColor: alertConfig.condition === item.key ? '#212121' : '#F5F5F5' }}
                  >
                    <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: alertConfig.condition === item.key ? '#FFF' : '#666' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location */}
            <View style={{ paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#212121', marginBottom: hp(8) }}>Location</Text>

              {/* Selected location chips */}
              {alertConfig.locations.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: wp(6), marginBottom: hp(8) }}>
                  {alertConfig.locations.map(code => {
                    const country = ALL_COUNTRIES.find(c => c.code === code);
                    const label = code === 'EU' ? 'EU' : (country?.name || code);
                    return (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setAlertConfig(c => ({ ...c, locations: c.locations.filter(l => l !== code) }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: wp(4), backgroundColor: '#F0F0F0', borderRadius: sp(99), paddingHorizontal: wp(10), paddingVertical: hp(5) }}
                      >
                        {code === 'EU' ? <Text style={{ fontSize: fp(13) }}>🇪🇺</Text> : <CountryFlag countryCode={code} size={13} />}
                        <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(12), color: '#212121' }}>{label}</Text>
                        <Svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                          <Path d="M4 4L12 12M12 4L4 12" stroke="#666" strokeWidth={1.5} strokeLinecap="round" />
                        </Svg>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Search input at top when focused */}
              {alertLocationSearchFocused && (
                <View style={{ marginBottom: hp(8) }}>
                  <TextInput
                    style={{ height: hp(40), borderWidth: 1, borderColor: '#E5E5E5', borderRadius: sp(10), paddingHorizontal: wp(12), fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}
                    placeholder="Search country..."
                    placeholderTextColor="#8E8E93"
                    value={alertLocationSearch}
                    onChangeText={setAlertLocationSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    onBlur={() => { setAlertLocationSearchFocused(false); setAlertLocationSearch(''); }}
                  />
                </View>
              )}

              {alertLocationSearchFocused ? (
                /* Search results */
                ALL_COUNTRIES
                  .filter(c => alertLocationSearch.trim().length === 0 || c.name.toLowerCase().includes(alertLocationSearch.toLowerCase().trim()))
                  .map(loc => {
                    const isSelected = alertConfig.locations.includes(loc.code);
                    return (
                      <TouchableOpacity
                        key={loc.code}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: wp(10), paddingVertical: hp(10), borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' }}
                        onPress={() => {
                          setAlertConfig(c => ({
                            ...c,
                            locations: c.locations.includes(loc.code)
                              ? c.locations.filter(l => l !== loc.code)
                              : [...c.locations, loc.code],
                          }));
                        }}
                      >
                        <CountryFlag countryCode={loc.code} size={18} />
                        <Text style={{ flex: 1, fontFamily: isSelected ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{loc.name}</Text>
                        {isSelected && (
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17L4 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        )}
                      </TouchableOpacity>
                    );
                  })
              ) : (
                /* Main locations + search input below China */
                <>
                  {[
                    { code: '', name: 'Worldwide', icon: '🌐' },
                    { code: 'EU', name: 'EU', icon: '🇪🇺' },
                    { code: 'HK', name: 'Hong Kong', icon: undefined },
                    { code: 'AE', name: 'United Arab Emirates', icon: undefined },
                    { code: 'GB', name: 'United Kingdom', icon: undefined },
                    { code: 'US', name: 'United States', icon: undefined },
                    { code: 'CH', name: 'Switzerland', icon: undefined },
                    { code: 'CN', name: 'China', icon: undefined },
                  ].map(loc => {
                    const isWorldwide = loc.code === '';
                    const isSelected = isWorldwide ? alertConfig.locations.length === 0 : alertConfig.locations.includes(loc.code);
                    return (
                      <TouchableOpacity
                        key={loc.code || 'ww'}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: wp(10), paddingVertical: hp(10), borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' }}
                        onPress={() => {
                          if (isWorldwide) {
                            setAlertConfig(c => ({ ...c, locations: [] }));
                          } else {
                            setAlertConfig(c => ({
                              ...c,
                              locations: c.locations.includes(loc.code)
                                ? c.locations.filter(l => l !== loc.code)
                                : [...c.locations, loc.code],
                            }));
                          }
                        }}
                      >
                        {loc.icon ? (
                          <Text style={{ fontSize: fp(18) }}>{loc.icon}</Text>
                        ) : (
                          <CountryFlag countryCode={loc.code} size={18} />
                        )}
                        <Text style={{ flex: 1, fontFamily: isSelected ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{loc.name}</Text>
                        {isSelected && (
                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17L4 12" stroke="#212121" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Separator + Search placeholder below China */}
                  <View style={{ height: 1, backgroundColor: '#E5E5E5', marginVertical: hp(8) }} />
                  <TouchableOpacity
                    style={{ height: hp(40), borderWidth: 1, borderColor: '#E5E5E5', borderRadius: sp(10), paddingHorizontal: wp(12), justifyContent: 'center' }}
                    onPress={() => setAlertLocationSearchFocused(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#8E8E93' }}>Search country...</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Price Threshold — 3 column layout */}
            <View style={{ paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#212121', marginBottom: hp(12) }}>Price Threshold</Text>

              <View style={{ flexDirection: 'row', gap: wp(12), height: hp(200) }}>
                {/* Direction column: Below / Above */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Direction</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {[{ key: 'below', label: '↓ Below' }, { key: 'above', label: '↑ Above' }].map(dir => (
                      <TouchableOpacity
                        key={dir.key}
                        onPress={() => setAlertConfig(c => ({ ...c, price_direction: dir.key }))}
                        style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: alertConfig.price_direction === dir.key ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                      >
                        <Text style={{ fontFamily: alertConfig.price_direction === dir.key ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{dir.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Amount column */}
                <View style={{ flex: 1, justifyContent: 'flex-start' }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Amount</Text>
                  <View style={{ borderWidth: 1, borderColor: '#E5E5E5', borderRadius: sp(8), paddingHorizontal: wp(8), height: hp(36), justifyContent: 'center' }}>
                    <TextInput
                      style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121', textAlign: 'center', padding: 0 }}
                      value={alertConfig.price_threshold}
                      onChangeText={(text) => setAlertConfig(c => ({ ...c, price_threshold: text.replace(/[^0-9]/g, '') }))}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      placeholder="0"
                      placeholderTextColor="#8E8E93"
                      inputAccessoryViewID="alertPriceDone"
                      onFocus={() => { setTimeout(() => alertScrollRef.current?.scrollToEnd({ animated: true }), 300); }}
                    />
                  </View>
                </View>

                {/* Currency column */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(13), color: '#8E8E93', marginBottom: hp(8), textAlign: 'center' }}>Currency</Text>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {['USD', 'EUR', 'HKD', 'AED', 'GBP', 'CHF', 'CNY'].map(cur => (
                      <TouchableOpacity
                        key={cur}
                        onPress={() => setAlertConfig(c => ({ ...c, currency: cur }))}
                        style={{ paddingVertical: hp(8), alignItems: 'center', backgroundColor: alertConfig.currency === cur ? '#F0F0F0' : 'transparent', borderRadius: sp(8) }}
                      >
                        <Text style={{ fontFamily: alertConfig.currency === cur ? 'HankenGrotesk_600SemiBold' : 'HankenGrotesk_500Medium', fontSize: fp(14), color: '#212121' }}>{cur}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={{ height: hp(100) }} />
          </ScrollView>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: wp(8), paddingHorizontal: wp(16), paddingVertical: hp(16), borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
            {editingAlertId && (
              <TouchableOpacity
                onPress={handleRemoveAlert}
                disabled={alertLoading}
                style={{ flex: 1, paddingVertical: hp(14), borderRadius: sp(99), borderWidth: 1.5, borderColor: '#D35741', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#D35741' }}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSaveAlert}
              disabled={alertLoading}
              style={{ flex: 1, paddingVertical: hp(14), borderRadius: sp(99), backgroundColor: '#212121', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#FFFFFF' }}>
                {alertLoading ? 'Saving...' : 'Save Alert'}
              </Text>
            </TouchableOpacity>
          </View>
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID="alertPriceDone">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#F0F0F0', paddingHorizontal: wp(16), paddingVertical: hp(8), borderTopWidth: 0.5, borderTopColor: '#C8C8C8' }}>
                <TouchableOpacity onPress={Keyboard.dismiss}>
                  <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: fp(16), color: '#007AFF' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Year Filter Modal */}
      <Modal
        visible={showYearFilter}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowYearFilter(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearFilter(false)}
        >
          <View style={styles.filterModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHandle} />
            <Text style={styles.filterModalTitle}>Month / Year</Text>

            <View style={styles.yearFilterColumns}>
              {/* Month column */}
              <View style={styles.yearFilterColumn}>
                <Text style={styles.yearFilterColumnHeader}>Month</Text>
                <ScrollView style={styles.yearFilterScroll} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.yearFilterItem, selectedMonths.length === 0 && styles.yearFilterItemActive]}
                    onPress={() => setSelectedMonths([])}
                  >
                    <Text style={[styles.yearFilterItemText, selectedMonths.length === 0 && styles.yearFilterItemTextActive]}>All</Text>
                  </TouchableOpacity>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.yearFilterItem, selectedMonths.includes(m) && styles.yearFilterItemActive]}
                      onPress={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                    >
                      <Text style={[styles.yearFilterItemText, selectedMonths.includes(m) && styles.yearFilterItemTextActive]}>
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year column */}
              <View style={styles.yearFilterColumn}>
                <Text style={styles.yearFilterColumnHeader}>Year</Text>
                <ScrollView style={styles.yearFilterScroll} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.yearFilterItem, selectedYears.length === 0 && styles.yearFilterItemActive]}
                    onPress={() => setSelectedYears([])}
                  >
                    <Text style={[styles.yearFilterItemText, selectedYears.length === 0 && styles.yearFilterItemTextActive]}>All</Text>
                  </TouchableOpacity>
                  {Array.from({ length: 12 }, (_, i) => 2026 - i).map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearFilterItem, selectedYears.includes(y) && styles.yearFilterItemActive]}
                      onPress={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                    >
                      <Text style={[styles.yearFilterItemText, selectedYears.includes(y) && styles.yearFilterItemTextActive]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.yearFilterApplyButton}
              onPress={() => setShowYearFilter(false)}
            >
              <Text style={styles.yearFilterApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Remarks tooltip — chat-bubble anchored to the tapped pill */}
      <Modal
        visible={remarksBubble !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemarksBubble(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setRemarksBubble(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' }}
        >
          {remarksBubble && (() => {
            const screen = Dimensions.get('window');
            const bubbleMaxWidth = screen.width - wp(24);
            const sideMargin = wp(12);
            const tailSize = sp(7);
            const gap = hp(8);
            const anchorCenterX = remarksBubble.anchorX + remarksBubble.anchorWidth / 2;
            const measured = remarksBubbleSize !== null;
            const w = measured ? (remarksBubbleSize as { width: number; height: number }).width : 0;
            const h = measured ? (remarksBubbleSize as { width: number; height: number }).height : 0;
            let left = measured ? anchorCenterX - w / 2 : sideMargin;
            if (measured) {
              if (left < sideMargin) left = sideMargin;
              if (left + w > screen.width - sideMargin) left = screen.width - sideMargin - w;
            }
            const placeAbove = measured
              ? remarksBubble.anchorY - h - gap > hp(60)
              : true;
            const top = measured
              ? (placeAbove
                  ? remarksBubble.anchorY - h - gap
                  : remarksBubble.anchorY + remarksBubble.anchorHeight + gap)
              : remarksBubble.anchorY;
            const tailLeft = measured
              ? Math.max(sp(14), Math.min(w - sp(14) - tailSize * 2, anchorCenterX - left - tailSize))
              : 0;
            const parts = remarksBubble.text.split(/\s*;\s*/).filter(Boolean);
            return (
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', left, top, maxWidth: bubbleMaxWidth, alignSelf: 'flex-start', opacity: measured ? 1 : 0 }}
                onLayout={(e) => {
                  const { width: nw, height: nh } = e.nativeEvent.layout;
                  if (
                    remarksBubbleSize === null ||
                    Math.abs(remarksBubbleSize.width - nw) > 0.5 ||
                    Math.abs(remarksBubbleSize.height - nh) > 0.5
                  ) {
                    setRemarksBubbleSize({ width: nw, height: nh });
                  }
                }}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                  {/* Top tail (when bubble is below the row) */}
                  {!placeAbove && (
                    <>
                      <View
                        style={{
                          position: 'absolute',
                          top: -tailSize,
                          left: tailLeft,
                          width: 0, height: 0,
                          borderLeftWidth: tailSize, borderRightWidth: tailSize, borderBottomWidth: tailSize,
                          borderLeftColor: 'transparent', borderRightColor: 'transparent',
                          borderBottomColor: '#F5F5F5',
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          top: -tailSize + 1.5,
                          left: tailLeft,
                          width: 0, height: 0,
                          borderLeftWidth: tailSize, borderRightWidth: tailSize, borderBottomWidth: tailSize,
                          borderLeftColor: 'transparent', borderRightColor: 'transparent',
                          borderBottomColor: '#FFFFFF',
                        }}
                      />
                    </>
                  )}
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: sp(14),
                      borderWidth: 1,
                      borderColor: '#F5F5F5',
                      paddingHorizontal: wp(12),
                      paddingVertical: hp(10),
                      shadowColor: '#000',
                      shadowOpacity: 0.12,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: -wp(6), marginBottom: -hp(6) }}>
                      {parts.map((part, i) => (
                        <View
                          key={i}
                          style={{
                            backgroundColor: 'rgba(33,33,33,0.06)',
                            paddingHorizontal: wp(10),
                            paddingVertical: hp(5),
                            borderRadius: sp(99),
                            marginRight: wp(6),
                            marginBottom: hp(6),
                          }}
                        >
                          <Text style={{ fontFamily: 'HankenGrotesk_500Medium', fontSize: fp(12), color: '#212121' }}>
                            {part}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {/* Bottom tail (when bubble is above the row) */}
                  {placeAbove && (
                    <>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -tailSize,
                          left: tailLeft,
                          width: 0, height: 0,
                          borderLeftWidth: tailSize, borderRightWidth: tailSize, borderTopWidth: tailSize,
                          borderLeftColor: 'transparent', borderRightColor: 'transparent',
                          borderTopColor: '#F5F5F5',
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -tailSize + 1.5,
                          left: tailLeft,
                          width: 0, height: 0,
                          borderLeftWidth: tailSize, borderRightWidth: tailSize, borderTopWidth: tailSize,
                          borderLeftColor: 'transparent', borderRightColor: 'transparent',
                          borderTopColor: '#FFFFFF',
                        }}
                      />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}
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
    paddingTop: hp(24),
    paddingBottom: hp(0),
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
    fontSize: fp(13),
    color: '#212121',
    paddingVertical: hp(8),
    paddingHorizontal: wp(8),
    letterSpacing: 0.075,
    lineHeight: fp(18),
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
    paddingHorizontal: wp(8),
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
    marginRight: wp(54),
  },
  orderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    position: 'absolute',
    right: wp(16),
    bottom: hp(25),
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
  // V2-Off Filters
  v2OffFiltersSection: {
    paddingHorizontal: wp(16),
    paddingTop: hp(20),
    paddingBottom: hp(8),
  },
  v2OffFiltersTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    color: '#212121',
    letterSpacing: 0.09,
    lineHeight: fp(22),
    marginBottom: hp(12),
  },
  v2OffFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(10),
  },
  v2OffFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(10),
    borderRadius: sp(99),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    gap: wp(6),
  },
  v2OffFilterButtonActive: {
    borderColor: '#212121',
    backgroundColor: '#F5F5F5',
  },
  v2OffFilterButtonText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#212121',
    letterSpacing: 0.07,
  },
  v2OffFilterButtonTextActive: {
    color: '#212121',
    fontFamily: 'HankenGrotesk_600SemiBold',
  },
  // Filter Modals
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: sp(24),
    borderTopRightRadius: sp(24),
    paddingTop: hp(12),
    paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(24),
    maxHeight: '70%',
  },
  filterModalHandle: {
    width: sp(36),
    height: sp(4),
    borderRadius: sp(2),
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: hp(16),
  },
  filterModalTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    color: '#212121',
    paddingHorizontal: wp(20),
    marginBottom: hp(16),
  },
  filterModalScroll: {
    paddingHorizontal: wp(20),
  },
  filterModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: wp(12),
  },
  filterModalOptionIcon: {
    fontSize: fp(20),
    width: sp(24),
    textAlign: 'center',
  },
  filterModalOptionText: {
    flex: 1,
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#666666',
    letterSpacing: 0.075,
  },
  filterModalOptionTextActive: {
    color: '#212121',
    fontFamily: 'HankenGrotesk_600SemiBold',
  },
  filterModalCheckmark: {
    width: sp(24),
    height: sp(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Year Filter
  yearFilterColumns: {
    flexDirection: 'row',
    paddingHorizontal: wp(20),
    gap: wp(16),
    height: hp(280),
  },
  yearFilterColumn: {
    flex: 1,
  },
  yearFilterColumnHeader: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    color: '#8E8E93',
    textAlign: 'center',
    paddingBottom: hp(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: hp(4),
  },
  yearFilterScroll: {
    flex: 1,
  },
  yearFilterItem: {
    paddingVertical: hp(10),
    paddingHorizontal: wp(12),
    borderRadius: sp(10),
    alignItems: 'center',
  },
  yearFilterItemActive: {
    backgroundColor: '#F0F0F0',
  },
  yearFilterItemText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#666666',
  },
  yearFilterItemTextActive: {
    color: '#212121',
    fontFamily: 'HankenGrotesk_600SemiBold',
  },
  yearFilterApplyButton: {
    marginHorizontal: wp(20),
    marginTop: hp(16),
    paddingVertical: hp(14),
    borderRadius: sp(99),
    backgroundColor: '#212121',
    alignItems: 'center',
  },
  yearFilterApplyText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#FFFFFF',
  },
});
