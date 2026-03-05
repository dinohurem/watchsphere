import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ListFilter,
  Star,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { useV2 } from '@/contexts/V2Context';

// Custom Order Book Icon matching mobile design
function OrderBookIcon({ size = 20, color = '#1D1D1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_orderbook)">
        <path d="M7.47168 7.47165V3.32071C7.47168 1.94521 8.58671 0.830139 9.96225 0.830139C11.3378 0.830139 12.4528 1.94521 12.4528 3.32071V7.47165" stroke={color} strokeWidth="1.66038" strokeLinecap="square"/>
        <path d="M15.7741 7.4711V4.98053H9.96279H4.15148V9.96166L2.88828 16.2776C2.68278 17.3049 3.46863 18.2635 4.51641 18.2635H8.30241" stroke={color} strokeWidth="1.66038" strokeMiterlimit="10" strokeLinecap="square"/>
        <path d="M17.4353 10.7921H12.4542C11.9957 10.7921 11.624 11.1637 11.624 11.6222V18.2638L14.9448 15.7732L18.2655 18.2638V11.6222C18.2655 11.1637 17.8939 10.7921 17.4353 10.7921Z" stroke={color} strokeWidth="1.66038" strokeMiterlimit="10" strokeLinecap="square"/>
      </g>
      <defs>
        <clipPath id="clip0_orderbook">
          <rect width="19.9245" height="19.9245" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

// Custom Social Search Icon matching mobile design
function SocialSearchIcon({ size = 20, color = '#1D1D1F' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 12C9.53757 12 12 9.53757 12 6.5C12 3.46243 9.53757 1 6.5 1C3.46243 1 1 3.46243 1 6.5C1 9.53757 3.46243 12 6.5 12Z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 6.5H12" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 1C7.93261 2.55556 8.75 4.47826 8.75 6.5C8.75 8.52174 7.93261 10.4444 6.5 12C5.06739 10.4444 4.25 8.52174 4.25 6.5C4.25 4.47826 5.06739 2.55556 6.5 1Z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 10.5L15 15" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PriceData {
  bestBid: number;
  bestAsk: number;
  spread: number;
  currentPrice: number;
  priceChange: number;
  minPrice: number;
  maxPrice: number;
}

interface OrderBookEntry {
  id: string;
  market: string;
  flag: string;
  date: string;
  condition: 'Unworn' | 'Used';
  price: number;
  order_type: 'buy' | 'sell';
  whatsapp_phone?: string;
  currency?: string;
  remarks?: string;
  country_name?: string;
}

interface WatchDetails {
  id: string;
  brand: string;
  model: string;
  reference: string;
  ws_code?: string;
  image?: string;
  currency: string;
  priceData: PriceData;
}

interface OrderFormData {
  order_type: 'buy' | 'sell';
  price: number;
  condition: 'Unworn' | 'Used';
  country_code: string;
  has_box: boolean;
  has_papers: boolean;
  notes: string;
}

const emptyOrderForm: OrderFormData = {
  order_type: 'buy',
  price: 0,
  condition: 'Unworn',
  country_code: 'US',
  has_box: false,
  has_papers: false,
  notes: '',
};

interface FilterState {
  [key: string]: string[];
}

const formatCurrency = (price: number, currency?: string): string => {
  if (!currency || currency === 'EUR') return `€${price.toLocaleString()}`;
  return `${currency} ${price.toLocaleString()}`;
};

export function WatchDetailsPage() {
  const { watchId } = useParams<{ watchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Get filters from navigation state (when returning from filters page)
  const appliedFilters: FilterState = location.state?.filters || {};
  const hasActiveFilters = Object.values(appliedFilters).some(arr => arr?.length > 0);

  const { v2Enabled } = useV2();

  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '1m' | '3m' | '1y'>('1m');
  const [orderBookTab, setOrderBookTab] = useState<'buy' | 'sell'>('sell');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchDetails, setWatchDetails] = useState<WatchDetails | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookEntry[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  // Order Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmedPrice, setConfirmedPrice] = useState(0);
  const [orderFormData, setOrderFormData] = useState<OrderFormData>(emptyOrderForm);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Full Order Book Modal state
  const [showFullOrderBook, setShowFullOrderBook] = useState(false);

  // Interactive chart state
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  const periods = ['1d', '7d', '1m', '3m', '1y'] as const;

  // Reload watch details when navigating back to this page (e.g., after creating an order)
  useEffect(() => {
    fetchWatchDetails();
  }, [watchId, location.key]);

  // Check watchlist status when authenticated
  useEffect(() => {
    const checkWatchlistStatus = async () => {
      if (!isAuthenticated || !watchDetails?.id) return;
      try {
        const response = await api.get('/profile/watchlist');
        const watchlist = response.data || [];
        const isWatchlisted = watchlist.some((item: any) =>
          item.watch_id === watchDetails.id ||
          (watchDetails.ws_code && item.ws_code === watchDetails.ws_code) ||
          item.reference === watchDetails.reference
        );
        setIsInWatchlist(isWatchlisted);
      } catch (error) {
        console.error('Failed to check watchlist status:', error);
      }
    };
    checkWatchlistStatus();
  }, [isAuthenticated, watchDetails?.id, watchDetails?.reference]);

  // Full price history from real sell orders (date + price pairs)
  const [fullPriceHistory, setFullPriceHistory] = useState<{ date: string; price: number }[]>([]);

  // Fetch real price history from sell orders
  useEffect(() => {
    if (!watchDetails?.reference && !watchDetails?.ws_code) return;

    const fetchPriceHistory = async () => {
      try {
        const lookupKey = watchDetails.ws_code || watchDetails.reference;
        const response = await api.get(`/orders/price-history/${encodeURIComponent(lookupKey)}?days=365`);
        if (response.data?.points) {
          setFullPriceHistory(response.data.points);
        }
      } catch (error) {
        console.log('Could not load price history');
      }
    };

    fetchPriceHistory();
  }, [watchDetails?.reference, watchDetails?.ws_code]);

  // Slice the appropriate portion based on selected period (like zooming in/out)
  useEffect(() => {
    if (fullPriceHistory.length === 0) {
      setPriceHistory([]);
      return;
    }

    // Days to show for each period
    const daysMap = { '1d': 1, '7d': 7, '1m': 30, '3m': 90, '1y': 365 };
    const days = daysMap[selectedPeriod];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const filtered = fullPriceHistory
      .filter(p => p.date >= cutoffStr)
      .map(p => p.price);

    // For shorter periods, sample to get reasonable number of points
    const maxPoints = 50;
    if (filtered.length > maxPoints) {
      const step = Math.ceil(filtered.length / maxPoints);
      const sampled = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);
      setPriceHistory(sampled);
    } else {
      setPriceHistory(filtered);
    }
  }, [selectedPeriod, fullPriceHistory]);

  const fetchWatchDetails = async () => {
    if (!watchId) return;

    try {
      setLoading(true);

      // Fetch watch details (encode watchId in case reference contains slashes)
      const watchResponse = await api.get(`/market/${encodeURIComponent(watchId)}`);
      const watch = watchResponse.data;

      // Try to fetch order book if there's a reference
      let buyOrders: OrderBookEntry[] = [];
      let sellOrders: OrderBookEntry[] = [];
      let bestBid = 0;
      let bestAsk = 0;

      const orderBookLookup = watch.ws_code || watch.reference;
      if (orderBookLookup) {
        try {
          const orderBookResponse = await api.get(`/orders/book/${encodeURIComponent(orderBookLookup)}`);
          const orderBookData = orderBookResponse.data;

          buyOrders = (orderBookData.buy_orders || []).map((o: any) => {
            let dateStr = o.date || '--';
            // Convert MM.DD.YY to MM/YY format
            const dateParts = dateStr.split('.');
            if (dateParts.length === 3) {
              dateStr = `${dateParts[0]}/${dateParts[2]}`;
            } else if (dateStr === '--' && o.created_at) {
              const d = new Date(o.created_at);
              if (!isNaN(d.getTime())) {
                dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear() % 100).toString().padStart(2, '0')}`;
              }
            }
            return {
              id: o.id,
              market: o.country_code || 'US',
              flag: getFlagEmoji(o.country_code || 'US'),
              date: dateStr,
              condition: o.condition || 'Unworn',
              price: o.price,
              order_type: 'buy' as const,
              whatsapp_phone: o.whatsapp_phone,
              currency: o.currency || 'EUR',
              remarks: o.remarks,
              country_name: o.country_name,
            };
          });

          sellOrders = (orderBookData.sell_orders || []).map((o: any) => {
            let dateStr = o.date || '--';
            // Convert MM.DD.YY to MM/YY format
            const dateParts = dateStr.split('.');
            if (dateParts.length === 3) {
              dateStr = `${dateParts[0]}/${dateParts[2]}`;
            } else if (dateStr === '--' && o.created_at) {
              const d = new Date(o.created_at);
              if (!isNaN(d.getTime())) {
                dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear() % 100).toString().padStart(2, '0')}`;
              }
            }
            return {
              id: o.id,
              market: o.country_code || 'US',
              flag: getFlagEmoji(o.country_code || 'US'),
              date: dateStr,
              condition: o.condition || 'Unworn',
              price: o.price,
              order_type: 'sell' as const,
              whatsapp_phone: o.whatsapp_phone,
              currency: o.currency || 'EUR',
              remarks: o.remarks,
              country_name: o.country_name,
            };
          });

          bestBid = orderBookData.highest_bid || 0;
          bestAsk = orderBookData.lowest_ask || 0;
        } catch (error) {
          // Order book not available
        }
      }

      setOrderBook([...buyOrders, ...sellOrders]);

      const minPrice = watch.price * 0.8;
      const maxPrice = watch.price * 1.2;

      // Use the lowest sell order's currency when available (matches order book display)
      const lowestSellOrder = sellOrders.length > 0
        ? sellOrders.reduce((min, o) => o.price < min.price ? o : min, sellOrders[0])
        : null;
      const displayCurrency = lowestSellOrder?.currency || watch.currency || 'EUR';

      setWatchDetails({
        id: watch.id,
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference || '',
        ws_code: watch.ws_code,
        image: watch.cover_image,
        currency: displayCurrency,
        priceData: {
          bestBid: bestBid || watch.price * 0.95,
          bestAsk: bestAsk || watch.price,
          spread: (bestAsk || watch.price) - (bestBid || watch.price * 0.95),
          currentPrice: lowestSellOrder ? lowestSellOrder.price : watch.price,
          priceChange: watch.price_change || 0,
          minPrice,
          maxPrice,
        },
      });

      // Set default order form price
      setOrderFormData(prev => ({
        ...prev,
        price: watch.price,
      }));
    } catch (error) {
      console.error('Failed to fetch watch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const handlePlaceOrder = (type: 'buy' | 'sell') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (type === 'sell') {
      // For Sell Order: Skip modal and route directly to create listing page
      navigate('/app/inventory/create', {
        state: {
          brand: watchDetails?.brand,
          model: watchDetails?.model,
          reference: watchDetails?.reference,
          watchId: watchDetails?.id,
          orderType: 'sell',
        }
      });
      return;
    }

    // For Buy Order: Show the "Make an offer" modal first
    setOrderFormData({
      ...emptyOrderForm,
      order_type: type,
      price: watchDetails?.priceData.bestBid || 0,
    });
    setOrderError(null);
    setShowOrderModal(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchDetails) return;

    setSavingOrder(true);
    setOrderError(null);

    try {
      // Store the confirmed price and show confirmation modal
      setConfirmedPrice(orderFormData.price);
      setShowOrderModal(false);
      setShowConfirmationModal(true);

      // After showing confirmation, navigate to create listing page for buy order
      // with the offer price prepopulated
      setTimeout(() => {
        setShowConfirmationModal(false);
        navigate('/app/inventory/create', {
          state: {
            brand: watchDetails.brand,
            model: watchDetails.model,
            reference: watchDetails.reference,
            watchId: watchDetails.id,
            orderType: 'buy',
            price: orderFormData.price,
          }
        });
      }, 1500); // Show confirmation for 1.5 seconds before navigating
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setOrderError(error.response?.data?.detail || t('watchDetails.failedToCreateOrder'));
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleWatchlist = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const identifier = watchDetails?.ws_code || watchDetails?.reference || '';
      if (isInWatchlist) {
        // Remove from watchlist
        await api.delete(`/profile/watchlist/${encodeURIComponent(identifier)}`);
        setIsInWatchlist(false);
      } else {
        // Add to watchlist
        await api.post('/profile/watchlist', {
          watch_id: watchDetails?.id,
          reference: watchDetails?.reference,
          ws_code: watchDetails?.ws_code,
          brand: watchDetails?.brand,
          model: watchDetails?.model,
        });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    }
  };

  const handleWhatsAppChat = (entry: OrderBookEntry) => {
    if (!entry.whatsapp_phone) return;
    const watchName = watchDetails ? `${watchDetails.brand} ${watchDetails.model}` : '';
    const watchCode = watchDetails?.reference || '';
    const currency = entry.currency || 'EUR';
    const message = `Hi, is ${watchName} ${watchCode} available?\n${currency} ${entry.price.toLocaleString('de-DE')} - thank you very much!`;
    const phone = entry.whatsapp_phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Apply filters to order book
  const filteredOrderBook = useMemo(() => {
    let filtered = orderBook.filter(entry => entry.order_type === orderBookTab);

    // Apply condition filter if present
    const conditionFilter = appliedFilters['condition'] || [];
    if (conditionFilter.length > 0) {
      filtered = filtered.filter(entry => conditionFilter.includes(entry.condition));
    }

    // Apply market/country filter if present
    const marketFilter = appliedFilters['market'] || appliedFilters['country'] || [];
    if (marketFilter.length > 0) {
      filtered = filtered.filter(entry => marketFilter.includes(entry.market));
    }

    return filtered;
  }, [orderBook, orderBookTab, appliedFilters]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f]"></div>
      </div>
    );
  }

  if (!watchDetails) {
    return (
      <div className="p-4 lg:p-6 bg-white min-h-screen">
        <div className="max-w-[1000px] mx-auto py-8 text-center">
          <p className="text-[#1d1d1f]/50">{t('watchDetails.watchNotFound')}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-[#1d1d1f] hover:underline">
            {t('watchDetails.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-[rgba(29,29,31,0.02)] transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-[#1d1d1f]" />
          </button>
          <div>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] leading-[1.2]">
              {watchDetails.brand} {watchDetails.model}
            </h1>
            <p className="text-[15px] text-[#1d1d1f]/50 leading-[1.3]">{watchDetails.ws_code || watchDetails.reference}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {v2Enabled && (
            <>
              {/* Order Book - opens the full order book modal */}
              <button
                onClick={() => setShowFullOrderBook(true)}
                className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-[rgba(29,29,31,0.02)] transition-colors"
              >
                <OrderBookIcon size={20} color="rgba(29,29,31,0.6)" />
              </button>
              {/* Filters */}
              <button
                onClick={() => navigate('/app/market/filters', { state: { fromWatchDetails: true, watchId } })}
                className={`w-10 h-10 rounded-full border flex items-center justify-center hover:bg-[rgba(29,29,31,0.02)] transition-colors relative ${
                  hasActiveFilters ? 'border-[#1d1d1f] bg-[rgba(29,29,31,0.05)]' : 'border-black/10'
                }`}
              >
                <ListFilter className={`w-5 h-5 ${hasActiveFilters ? 'text-[#1d1d1f]' : 'text-[#1d1d1f]/60'}`} />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#1d1d1f] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                    {Object.values(appliedFilters).reduce((sum, arr) => sum + (arr?.length || 0), 0)}
                  </span>
                )}
              </button>
            </>
          )}
          {/* Watchlist - toggles watchlist status */}
          <button
            onClick={toggleWatchlist}
            className={`w-10 h-10 rounded-full border flex items-center justify-center hover:bg-[rgba(29,29,31,0.02)] transition-colors ${
              isInWatchlist ? 'border-[#1d1d1f] bg-[rgba(29,29,31,0.05)]' : 'border-black/10'
            }`}
          >
            <Star
              className={`w-5 h-5 ${isInWatchlist ? 'text-[#1d1d1f] fill-[#1d1d1f]' : 'text-[#1d1d1f]/60'}`}
            />
          </button>
          {/* Social Search - navigates to social search */}
          {v2Enabled && (
          <button
            onClick={() => navigate('/app/social-search')}
            className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-[rgba(29,29,31,0.02)] transition-colors"
          >
            <SocialSearchIcon size={20} color="rgba(29,29,31,0.6)" />
          </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Watch Image */}
        <div className="w-full lg:w-[340px] flex flex-col gap-4">
          {/* Watch Image Card */}
          <div className="bg-gradient-to-b from-[#FAFAFA] to-[#F0F0F0] rounded-2xl border border-black/5 overflow-hidden">
            {/* Watch Image Area */}
            <div className="h-[300px] flex items-center justify-center p-6">
              {watchDetails.image ? (
                <img
                  src={watchDetails.image}
                  alt={`${watchDetails.brand} ${watchDetails.reference}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <ImagePlaceholder width={200} height={200} borderRadius={0} />
              )}
            </div>

            {/* Price Range - at bottom of card */}
            <div className="px-4 pb-4 pt-2">
              {v2Enabled ? (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[12px] text-[#1d1d1f]/50 leading-[1.3]">{t('watchDetails.marketPrice')}</p>
                    <p className="text-[15px] font-semibold text-[#1d1d1f] leading-[1.3]">
                      {formatCurrency(watchDetails.priceData.minPrice, watchDetails.currency)} - {formatCurrency(watchDetails.priceData.maxPrice, watchDetails.currency)}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${
                    watchDetails.priceData.priceChange >= 0 ? 'bg-[rgba(74,160,120,0.1)]' : 'bg-[rgba(201,57,39,0.1)]'
                  }`}>
                    {watchDetails.priceData.priceChange >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-[#4aa078]" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-[#c93927]" />
                    )}
                    <span className={`text-[12px] font-semibold ${
                      watchDetails.priceData.priceChange >= 0 ? 'text-[#4aa078]' : 'text-[#c93927]'
                    }`}>
                      {Math.abs(watchDetails.priceData.priceChange * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold bg-[rgba(74,160,120,0.1)] text-[#4aa078]">
                      WTS {orderBook.filter(o => o.order_type === 'sell').length}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold bg-[rgba(91,155,213,0.1)] text-[#5B9BD5]">
                      WTB {orderBook.filter(o => o.order_type === 'buy').length}
                    </span>
                  </div>
                  <button
                    onClick={toggleWatchlist}
                    className="p-1"
                  >
                    <Star
                      className={`w-5 h-5 ${isInWatchlist ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-[#1d1d1f]/30'}`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - half-pill style matching Figma exactly */}
          {v2Enabled && (
          <div className="flex gap-[12px] w-full">
            <button
              onClick={() => handlePlaceOrder('buy')}
              className="flex-1 h-[48px] bg-[#54b368] text-white text-[16px] font-semibold tracking-[0.08px] leading-[20px] rounded-bl-[64px] rounded-tl-[64px] rounded-br-[3px] rounded-tr-[3px] hover:bg-[#4aa35d] transition-colors"
            >
              {t('watchDetails.placeBuyOrder')}
            </button>
            <button
              onClick={() => handlePlaceOrder('sell')}
              className="flex-1 h-[48px] bg-[#d35741] text-white text-[16px] font-semibold tracking-[0.08px] leading-[20px] rounded-bl-[3px] rounded-tl-[3px] rounded-br-[64px] rounded-tr-[64px] hover:bg-[#c04a36] transition-colors"
            >
              {t('watchDetails.placeSellOrder')}
            </button>
          </div>
          )}
        </div>

        {/* Right Column - Charts and Order Book */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Price Stats */}
          {v2Enabled && (
          <div className="flex border border-black/5 rounded-2xl overflow-hidden">
            <div className="flex-1 p-5 text-center border-r border-black/5">
              <p className="text-[22px] font-semibold text-[#1d1d1f] leading-[1.2]">
                {formatCurrency(watchDetails.priceData.bestBid, watchDetails.currency)}
              </p>
              <p className="text-[13px] text-[#1d1d1f]/50 leading-[1.3] mt-1">{t('watchDetails.bestBid')}</p>
            </div>
            <div className="flex-1 p-5 text-center border-r border-black/5">
              <p className="text-[22px] font-semibold text-[#1d1d1f] leading-[1.2]">
                {formatCurrency(watchDetails.priceData.bestAsk, watchDetails.currency)}
              </p>
              <p className="text-[13px] text-[#1d1d1f]/50 leading-[1.3] mt-1">{t('watchDetails.bestAsk')}</p>
            </div>
            <div className="flex-1 p-5 text-center">
              <p className="text-[22px] font-semibold text-[#1d1d1f] leading-[1.2]">
                {formatCurrency(watchDetails.priceData.spread, watchDetails.currency)}
              </p>
              <p className="text-[13px] text-[#1d1d1f]/50 leading-[1.3] mt-1">{t('watchDetails.spread')}</p>
            </div>
          </div>
          )}

          {/* Price Chart */}
          {v2Enabled && (
          <div className="flex-1">
            {/* Chart Area */}
            <div className="h-[200px] mb-4 relative">
              {/* Price tooltip - shows selected point or current price */}
              {priceHistory.length > 0 && (() => {
                const displayIndex = selectedPointIndex !== null ? selectedPointIndex : priceHistory.length - 1;
                const displayPrice = priceHistory[displayIndex];

                // Calculate date for the selected point
                const daysMap = { '1d': 1, '7d': 7, '1m': 30, '3m': 90, '1y': 365 };
                const totalDays = daysMap[selectedPeriod];
                const daysAgo = Math.round((priceHistory.length - 1 - displayIndex) / (priceHistory.length - 1) * totalDays);
                const displayDate = new Date();
                displayDate.setDate(displayDate.getDate() - daysAgo);

                const isPositive = displayPrice >= (priceHistory[0] || displayPrice);

                return (
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1d1d1f] text-white text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-2 z-10 pointer-events-none"
                  >
                    <span className={`font-semibold ${isPositive ? 'text-[#4aa078]' : 'text-[#c93927]'}`}>
                      {formatCurrency(displayPrice || watchDetails.priceData.currentPrice, watchDetails.currency)}
                    </span>
                    <span className="text-white/60">
                      {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                );
              })()}
              {/* Chart visualization with area fill */}
              <div className="flex h-full">
                <div className="flex-1 relative">
                  {priceHistory.length > 0 && (() => {
                    const minPrice = Math.min(...priceHistory);
                    const maxPrice = Math.max(...priceHistory);
                    const range = maxPrice - minPrice || 1;
                    const height = 160;
                    const width = 500;
                    const padding = 10;

                    // Generate path points with coordinates stored for interaction
                    const pointCoordinates = priceHistory.map((price, index) => {
                      const x = (index / (priceHistory.length - 1)) * width;
                      const y = padding + ((maxPrice - price) / range) * (height - padding * 2);
                      return { x, y, price, index };
                    });

                    const points = pointCoordinates.map(p => `${p.x},${p.y}`);
                    const linePath = `M${points.join(' L')}`;
                    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

                    // Get the selected point or last point
                    const activePointData = selectedPointIndex !== null
                      ? pointCoordinates[selectedPointIndex]
                      : pointCoordinates[pointCoordinates.length - 1];

                    const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
                      if (!chartRef.current) return;

                      const rect = chartRef.current.getBoundingClientRect();
                      const clickX = ((e.clientX - rect.left) / rect.width) * width;

                      // Find the closest point to the click
                      let closestIndex = 0;
                      let closestDistance = Infinity;

                      pointCoordinates.forEach((point, index) => {
                        const distance = Math.abs(point.x - clickX);
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestIndex = index;
                        }
                      });

                      setSelectedPointIndex(closestIndex);
                    };

                    const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                      if (!chartRef.current) return;

                      const rect = chartRef.current.getBoundingClientRect();
                      const clickX = ((e.clientX - rect.left) / rect.width) * width;

                      // Find the closest point to the mouse position
                      let closestIndex = 0;
                      let closestDistance = Infinity;

                      pointCoordinates.forEach((point, index) => {
                        const distance = Math.abs(point.x - clickX);
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestIndex = index;
                        }
                      });

                      setSelectedPointIndex(closestIndex);
                    };

                    const handleChartMouseLeave = () => {
                      setSelectedPointIndex(null);
                    };

                    return (
                      <svg
                        ref={chartRef}
                        viewBox={`0 0 ${width} ${height}`}
                        className="w-full h-full cursor-crosshair"
                        preserveAspectRatio="none"
                        onClick={handleChartClick}
                        onMouseMove={handleChartMouseMove}
                        onMouseLeave={handleChartMouseLeave}
                      >
                        {/* Area fill */}
                        <path d={areaPath} fill="rgba(29,29,31,0.03)" />
                        {/* Line */}
                        <path d={linePath} fill="none" stroke="#1D1D1F" strokeWidth="1.5" />
                        {/* Vertical line at selected point */}
                        {activePointData && (
                          <line
                            x1={activePointData.x}
                            y1={0}
                            x2={activePointData.x}
                            y2={height}
                            stroke="rgba(29,29,31,0.2)"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                          />
                        )}
                        {/* Selected/Current price dot */}
                        {activePointData && (
                          <circle
                            cx={activePointData.x}
                            cy={activePointData.y}
                            r="6"
                            fill="#1D1D1F"
                            stroke="white"
                            strokeWidth="2"
                          />
                        )}
                      </svg>
                    );
                  })()}
                </div>
                {/* Y-axis labels */}
                <div className="w-16 flex flex-col justify-between text-[12px] text-[#1d1d1f]/50 text-right pl-3">
                  <span>{watchDetails.currency === 'EUR' ? '€' : watchDetails.currency + ' '}{(Math.max(...(priceHistory.length ? priceHistory : [watchDetails.priceData.maxPrice])) / 1000).toFixed(1)}K</span>
                  <span>{watchDetails.currency === 'EUR' ? '€' : watchDetails.currency + ' '}{(watchDetails.priceData.currentPrice / 1000).toFixed(1)}K</span>
                  <span>{watchDetails.currency === 'EUR' ? '€' : watchDetails.currency + ' '}{(Math.min(...(priceHistory.length ? priceHistory : [watchDetails.priceData.minPrice])) / 1000).toFixed(1)}K</span>
                </div>
              </div>
            </div>

            {/* Period Tabs - matching Figma exactly */}
            <div className="flex items-center justify-center gap-[12px] px-[2px] rounded-[112px]">
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setSelectedPeriod(period);
                    setSelectedPointIndex(null); // Reset selection when period changes
                  }}
                  className={`flex-1 h-[40px] px-[12px] py-[6px] text-[15px] tracking-[0.075px] leading-[20px] transition-colors rounded-[112px] ${
                    selectedPeriod === period
                      ? 'bg-[rgba(33,33,33,0.05)] text-[#212121] font-semibold'
                      : 'text-[#212121]/60 font-medium hover:text-[#212121]'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Order Book */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[24px] font-semibold text-[#1d1d1f] leading-[1.1] tracking-[-0.24px]">{t('watchDetails.orderBook')}</h2>
              {v2Enabled && (
                <button
                  onClick={() => setShowFullOrderBook(true)}
                  className="text-[16px] font-semibold text-[#212121] tracking-[0.08px] leading-[20px] hover:opacity-70 flex items-center gap-[12px] transition-colors"
                >
                  {t('watchDetails.seeOrderBook')}
                  <span className="text-[18px]">→</span>
                </button>
              )}
            </div>

            {/* Order Book Tabs - iOS segmented control style */}
            <div className="flex bg-[rgba(118,118,128,0.12)] rounded-[100px] h-[36px] px-[8px] py-[4px] mb-6">
              <button
                onClick={() => setOrderBookTab('sell')}
                className={`relative flex-1 flex items-center justify-center px-[10px] py-[2px] rounded-[20px] text-[14px] tracking-[-0.08px] leading-[18px] transition-all ${
                  orderBookTab === 'sell'
                    ? 'bg-white text-black font-semibold shadow-[0px_2px_20px_0px_rgba(0,0,0,0.06)]'
                    : 'text-black font-medium'
                }`}
              >
                WTS
              </button>
              <button
                onClick={() => setOrderBookTab('buy')}
                className={`relative flex-1 flex items-center justify-center px-[10px] py-[2px] rounded-[20px] text-[14px] tracking-[-0.08px] leading-[18px] transition-all ${
                  orderBookTab === 'buy'
                    ? 'bg-white text-black font-semibold shadow-[0px_2px_20px_0px_rgba(0,0,0,0.06)]'
                    : 'text-black font-medium'
                }`}
              >
                WTB
              </button>
            </div>

            {/* Order Book Table */}
            <div className="overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center h-[44px] border-b border-[rgba(0,0,0,0.05)]">
                <span className={`${!v2Enabled ? 'w-[18%]' : 'w-[22%]'} pl-[12px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]`}>{!v2Enabled ? 'Location' : t('watchDetails.market')}</span>
                <span className={`${!v2Enabled ? 'w-[20%]' : 'w-[28%]'} px-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]`}>Details</span>
                {!v2Enabled && (
                  <span className="w-[22%] px-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]">Remarks</span>
                )}
                <span className="flex-1 pl-[4px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px] text-right">{!v2Enabled && orderBookTab === 'buy' ? 'Target' : t('watchDetails.price')}</span>
                <span className="w-[48px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px] text-center">Chat</span>
              </div>

              {/* Table Rows */}
              <div className={v2Enabled ? 'max-h-[400px] overflow-y-auto' : 'overflow-y-auto'}>
                {filteredOrderBook.length === 0 ? (
                  <div className="text-center py-8 text-[#212121]/50 text-[15px]">
                    {t('watchDetails.noOrdersAvailable', { type: orderBookTab })}
                  </div>
                ) : (
                  filteredOrderBook.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center min-h-[44px] transition-colors ${
                        index % 2 === 0 ? 'bg-[#fbfbfb]' : 'bg-white'
                      }`}
                    >
                      <span className={`${!v2Enabled ? 'w-[18%]' : 'w-[22%]'} pl-[12px] pr-[4px] py-[8px] flex items-center gap-[8px]`}>
                        <span className="text-[14px]">{entry.flag}</span>
                        <span className="text-[15px] font-medium text-[#212121] tracking-[-0.3px]">{!v2Enabled ? (entry.country_name || entry.market.toUpperCase()) : entry.market.toUpperCase()}</span>
                      </span>
                      <span className={`${!v2Enabled ? 'w-[20%]' : 'w-[28%]'} px-[4px] py-[6px] flex flex-col`}>
                        <span className="text-[15px] font-medium text-[#212121] tracking-[-0.3px]">{entry.condition}</span>
                        <span className="text-[12px] font-normal text-[#212121]/50 tracking-[-0.3px]">{entry.date}</span>
                      </span>
                      {!v2Enabled && (
                        <span className="w-[22%] px-[4px] py-[8px] text-[13px] font-normal text-[#212121]/70 tracking-[-0.3px] truncate">
                          {entry.remarks || '--'}
                        </span>
                      )}
                      <span className="flex-1 pl-[4px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[-0.3px] text-right">
                        {formatCurrency(entry.price, entry.currency)}
                      </span>
                      <button
                          className="w-[48px] flex items-center justify-center hover:opacity-70 transition-opacity"
                          onClick={() => handleWhatsAppChat(entry)}
                          title={entry.whatsapp_phone ? 'Chat on WhatsApp' : 'No WhatsApp available'}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#1D1D1F"/>
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.963 7.963 0 01-4.113-1.14l-.287-.172-2.978.78.795-2.898-.188-.299A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#1D1D1F"/>
                          </svg>
                        </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Creation Modal - Matching Figma design */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[420px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-[60px] border-b border-[rgba(33,33,33,0.05)]">
              <p className="text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]">
                {t('watchDetails.makeAnOffer')}
              </p>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-8 h-8 rounded-full bg-[rgba(120,120,128,0.12)] flex items-center justify-center hover:bg-[rgba(120,120,128,0.2)] transition-colors"
              >
                <X className="w-4 h-4 text-[#999]" />
              </button>
            </div>

            {/* Watch Info */}
            <div className="flex items-center gap-3 px-6 py-[13px] border-b border-[rgba(33,33,33,0.05)]">
              <div className="w-[79px] h-[78px] rounded-2xl border border-[rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-b from-[#FAFAFA] to-[#F0F0F0]">
                {watchDetails.image ? (
                  <img
                    src={watchDetails.image}
                    alt={watchDetails.model}
                    className="w-[60px] h-[60px] object-contain"
                  />
                ) : (
                  <ImagePlaceholder width={60} height={60} borderRadius={0} />
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <p className="text-[18px] font-semibold text-[#212121] tracking-[0.09px] leading-[20px] truncate">
                  {watchDetails.brand} {watchDetails.model}
                </p>
                <p className="text-[16px] font-medium text-[#1d1d1f]/50 leading-[1.3]">
                  {formatCurrency(watchDetails.priceData.minPrice, watchDetails.currency)} - {formatCurrency(watchDetails.priceData.maxPrice, watchDetails.currency)}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitOrder} className="p-6 flex flex-col gap-6">
              {orderError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
                  {orderError}
                </div>
              )}

              {/* Your Offer Input */}
              <div className="flex flex-col gap-[6px]">
                <label className="text-[15px] font-semibold text-[#1d1d1f] tracking-[0.075px] leading-[20px]">
                  {t('watchDetails.yourOffer')}
                </label>
                <div className="flex items-center gap-2 px-4 py-[14px] border border-[rgba(29,29,31,0.1)] rounded-2xl bg-white">
                  <span className="text-[15px] font-medium text-[#1d1d1f]/50 tracking-[0.075px] leading-[20px]">{watchDetails.currency === 'EUR' ? '€' : watchDetails.currency}</span>
                  <input
                    type="text"
                    required
                    value={orderFormData.price.toLocaleString()}
                    onChange={(e) => {
                      // Remove all non-digit characters (commas, dots, spaces used as thousand separators)
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      const num = parseInt(value, 10);
                      if (!isNaN(num)) {
                        setOrderFormData({ ...orderFormData, price: num });
                      } else if (value === '') {
                        setOrderFormData({ ...orderFormData, price: 0 });
                      }
                    }}
                    className="flex-1 text-[15px] font-medium text-[#1d1d1f] tracking-[0.075px] leading-[20px] outline-none bg-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={savingOrder || orderFormData.price <= 0}
                className="w-full h-[44px] bg-[#212121] text-white text-[16px] font-semibold tracking-[0.08px] leading-[20px] rounded-full hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingOrder ? t('watchDetails.submitting') : t('watchDetails.makeAnOffer')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Full Order Book Modal */}
      {showFullOrderBook && watchDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between shrink-0">
              <h2 className="text-[20px] font-semibold text-[#1d1d1f]">{t('watchDetails.orderBook')}</h2>
              <button
                onClick={() => setShowFullOrderBook(false)}
                className="p-2 hover:bg-[rgba(29,29,31,0.02)] rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#1d1d1f]" />
              </button>
            </div>

            {/* Watch Info */}
            <div className="px-6 py-4 border-b flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#FAFAFA] to-[#F0F0F0]">
                {watchDetails.image ? (
                  <img
                    src={watchDetails.image}
                    alt={watchDetails.model}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImagePlaceholder width={48} height={48} borderRadius={8} />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#1d1d1f] text-[15px]">{watchDetails.brand} {watchDetails.model}</p>
                <p className="text-[13px] text-[#1d1d1f]/50">
                  {formatCurrency(watchDetails.priceData.minPrice, watchDetails.currency)} - {formatCurrency(watchDetails.priceData.maxPrice, watchDetails.currency)}
                </p>
              </div>
            </div>

            {/* Order Book Tabs - iOS segmented control style */}
            <div className="px-6 pt-4 shrink-0 flex justify-center">
              <div className="flex bg-[rgba(118,118,128,0.12)] rounded-[100px] h-[36px] px-[8px] py-[4px] w-[280px]">
                <button
                  onClick={() => setOrderBookTab('sell')}
                  className={`relative flex-1 flex items-center justify-center px-[10px] py-[2px] rounded-[20px] text-[14px] tracking-[-0.08px] leading-[18px] transition-all ${
                    orderBookTab === 'sell'
                      ? 'bg-white text-black font-semibold shadow-[0px_2px_20px_0px_rgba(0,0,0,0.06)]'
                      : 'text-black font-medium'
                  }`}
                >
                  WTS
                </button>
                <button
                  onClick={() => setOrderBookTab('buy')}
                  className={`relative flex-1 flex items-center justify-center px-[10px] py-[2px] rounded-[20px] text-[14px] tracking-[-0.08px] leading-[18px] transition-all ${
                    orderBookTab === 'buy'
                      ? 'bg-white text-black font-semibold shadow-[0px_2px_20px_0px_rgba(0,0,0,0.06)]'
                      : 'text-black font-medium'
                  }`}
                >
                  WTB
                </button>
              </div>
            </div>

            {/* Order Book Table */}
            <div className="flex-1 overflow-hidden px-6 py-4">
              {/* Table Header */}
              <div className="flex items-center h-[44px] border-b border-[rgba(0,0,0,0.05)]">
                <span className={`${!v2Enabled ? 'w-[18%]' : 'w-[22%]'} pl-[12px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]`}>{!v2Enabled ? 'Location' : t('watchDetails.market')}</span>
                <span className={`${!v2Enabled ? 'w-[20%]' : 'w-[28%]'} px-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]`}>Details</span>
                {!v2Enabled && (
                  <span className="w-[22%] px-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]">Remarks</span>
                )}
                <span className="flex-1 pl-[4px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px] text-right">{!v2Enabled && orderBookTab === 'buy' ? 'Target' : t('watchDetails.price')}</span>
                <span className="w-[48px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px] text-center">Chat</span>
              </div>

              {/* Table Rows */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 280px)' }}>
                {filteredOrderBook.length === 0 ? (
                  <div className="text-center py-12 text-[#212121]/50 text-[15px]">
                    {t('watchDetails.noOrdersAvailable', { type: orderBookTab })}
                  </div>
                ) : (
                  filteredOrderBook.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center min-h-[44px] transition-colors ${
                        index % 2 === 0 ? 'bg-[#fbfbfb]' : 'bg-white'
                      }`}
                    >
                      <span className={`${!v2Enabled ? 'w-[18%]' : 'w-[22%]'} pl-[12px] pr-[4px] py-[8px] flex items-center gap-[8px]`}>
                        <span className="text-[14px]">{entry.flag}</span>
                        <span className="text-[15px] font-medium text-[#212121] tracking-[-0.3px]">{!v2Enabled ? (entry.country_name || entry.market.toUpperCase()) : entry.market.toUpperCase()}</span>
                      </span>
                      <span className={`${!v2Enabled ? 'w-[20%]' : 'w-[28%]'} px-[4px] py-[6px] flex flex-col`}>
                        <span className="text-[15px] font-medium text-[#212121] tracking-[-0.3px]">{entry.condition}</span>
                        <span className="text-[12px] font-normal text-[#212121]/50 tracking-[-0.3px]">{entry.date}</span>
                      </span>
                      {!v2Enabled && (
                        <span className="w-[22%] px-[4px] py-[8px] text-[13px] font-normal text-[#212121]/70 tracking-[-0.3px] truncate">
                          {entry.remarks || '--'}
                        </span>
                      )}
                      <span className="flex-1 pl-[4px] pr-[4px] py-[8px] text-[15px] font-semibold text-[#212121] tracking-[-0.3px] text-right">
                        {formatCurrency(entry.price, entry.currency)}
                      </span>
                      <button
                          className="w-[48px] flex items-center justify-center hover:opacity-70 transition-opacity"
                          onClick={() => handleWhatsAppChat(entry)}
                          title={entry.whatsapp_phone ? 'Chat on WhatsApp' : 'No WhatsApp available'}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#1D1D1F"/>
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.963 7.963 0 01-4.113-1.14l-.287-.172-2.978.78.795-2.898-.188-.299A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#1D1D1F"/>
                          </svg>
                        </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal - Matching Figma design */}
      {showConfirmationModal && watchDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-[0px_15px_75px_0px_rgba(0,0,0,0.18)] w-full max-w-[420px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-[60px] border-b border-[rgba(33,33,33,0.05)]">
              <p className="text-[15px] font-semibold text-[#212121] tracking-[0.075px] leading-[20px]">
                {t('watchDetails.makeAnOffer')}
              </p>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="w-8 h-8 rounded-full bg-[rgba(120,120,128,0.12)] flex items-center justify-center hover:bg-[rgba(120,120,128,0.2)] transition-colors"
              >
                <X className="w-4 h-4 text-[#999]" />
              </button>
            </div>

            {/* Watch Info */}
            <div className="flex items-center gap-3 px-6 py-[13px] border-b border-[rgba(33,33,33,0.05)]">
              <div className="w-[79px] h-[78px] rounded-2xl border border-[rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-b from-[#FAFAFA] to-[#F0F0F0]">
                {watchDetails.image ? (
                  <img
                    src={watchDetails.image}
                    alt={watchDetails.model}
                    className="w-[60px] h-[60px] object-contain"
                  />
                ) : (
                  <ImagePlaceholder width={60} height={60} borderRadius={0} />
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <p className="text-[18px] font-semibold text-[#212121] tracking-[0.09px] leading-[20px] truncate">
                  {watchDetails.brand} {watchDetails.model}
                </p>
                <p className="text-[16px] font-medium text-[#1d1d1f]/50 leading-[1.3]">
                  {formatCurrency(watchDetails.priceData.minPrice, watchDetails.currency)} - {formatCurrency(watchDetails.priceData.maxPrice, watchDetails.currency)}
                </p>
              </div>
            </div>

            {/* Confirmation Content */}
            <div className="p-6 flex flex-col items-center gap-4">
              {/* Success Icon */}
              <div className="w-[72px] h-[72px] rounded-full bg-[#007AFF]/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="#007AFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Offer Sent Text */}
              <p className="text-[15px] font-medium text-[#212121]/60 tracking-[0.075px] leading-[20px]">
                {t('watchDetails.offerSent')}
              </p>

              {/* Price */}
              <p className="text-[34px] font-bold text-[#212121] tracking-[-0.68px] leading-[1.1]">
                {formatCurrency(confirmedPrice, watchDetails?.currency)}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
