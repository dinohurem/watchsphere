import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  GitCompare,
  SlidersHorizontal,
  Share2,
  Star,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

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
}

interface WatchDetails {
  id: string;
  brand: string;
  model: string;
  reference: string;
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

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'JP', name: 'Japan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AU', name: 'Australia' },
];

const emptyOrderForm: OrderFormData = {
  order_type: 'buy',
  price: 0,
  condition: 'Unworn',
  country_code: 'US',
  has_box: false,
  has_papers: false,
  notes: '',
};

export function WatchDetailsPage() {
  const { watchId } = useParams<{ watchId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '1m' | '3m' | '1y'>('1m');
  const [orderBookTab, setOrderBookTab] = useState<'buy' | 'sell'>('buy');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchDetails, setWatchDetails] = useState<WatchDetails | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookEntry[]>([]);

  // Order Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderFormData, setOrderFormData] = useState<OrderFormData>(emptyOrderForm);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Full Order Book Modal state
  const [showFullOrderBook, setShowFullOrderBook] = useState(false);

  const periods = ['1d', '7d', '1m', '3m', '1y'] as const;

  useEffect(() => {
    fetchWatchDetails();
  }, [watchId]);

  const fetchWatchDetails = async () => {
    if (!watchId) return;

    try {
      setLoading(true);

      // Fetch watch details
      const watchResponse = await api.get(`/market/${watchId}`);
      const watch = watchResponse.data;

      // Try to fetch order book if there's a reference
      let buyOrders: OrderBookEntry[] = [];
      let sellOrders: OrderBookEntry[] = [];
      let bestBid = 0;
      let bestAsk = 0;

      if (watch.reference) {
        try {
          const orderBookResponse = await api.get(`/orders/book/${encodeURIComponent(watch.reference)}`);
          const orderBookData = orderBookResponse.data;

          buyOrders = (orderBookData.buy_orders || []).map((o: any) => ({
            id: o.id,
            market: o.country_code,
            flag: getFlagEmoji(o.country_code),
            date: new Date(o.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
            condition: o.condition,
            price: o.price,
            order_type: 'buy',
          }));

          sellOrders = (orderBookData.sell_orders || []).map((o: any) => ({
            id: o.id,
            market: o.country_code,
            flag: getFlagEmoji(o.country_code),
            date: new Date(o.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
            condition: o.condition,
            price: o.price,
            order_type: 'sell',
          }));

          bestBid = orderBookData.highest_bid || 0;
          bestAsk = orderBookData.lowest_ask || 0;
        } catch (error) {
          // Order book not available
        }
      }

      setOrderBook([...buyOrders, ...sellOrders]);

      const minPrice = watch.price * 0.8;
      const maxPrice = watch.price * 1.2;

      setWatchDetails({
        id: watch.id,
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference || '',
        image: watch.cover_image,
        currency: watch.currency || 'EUR',
        priceData: {
          bestBid: bestBid || watch.price * 0.95,
          bestAsk: bestAsk || watch.price,
          spread: (bestAsk || watch.price) - (bestBid || watch.price * 0.95),
          currentPrice: watch.price,
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

    setOrderFormData({
      ...emptyOrderForm,
      order_type: type,
      price: type === 'buy' ? (watchDetails?.priceData.bestBid || 0) : (watchDetails?.priceData.bestAsk || 0),
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
      await api.post('/orders', {
        order_type: orderFormData.order_type,
        brand: watchDetails.brand,
        model: watchDetails.model,
        reference: watchDetails.reference,
        watch_id: watchDetails.id,
        price: orderFormData.price,
        currency: watchDetails.currency,
        condition: orderFormData.condition,
        country_code: orderFormData.country_code,
        country_name: COUNTRIES.find(c => c.code === orderFormData.country_code)?.name,
        has_box: orderFormData.has_box,
        has_papers: orderFormData.has_papers,
        notes: orderFormData.notes || undefined,
      });

      setShowOrderModal(false);
      // Refresh order book
      fetchWatchDetails();
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setOrderError(error.response?.data?.detail || 'Failed to create order. Please try again.');
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleWatchlist = () => {
    setIsInWatchlist(!isInWatchlist);
  };

  const filteredOrderBook = orderBook.filter(entry => entry.order_type === orderBookTab);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!watchDetails) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto py-8 text-center">
          <p className="text-gray-500">Watch not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5 text-gray-900" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {watchDetails.brand} {watchDetails.model}
            </h1>
            <p className="text-sm sm:text-base text-gray-500">{watchDetails.reference}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-12 sm:ml-0">
          <button className="hidden sm:flex w-10 h-10 rounded-full border border-black/10 items-center justify-center hover:bg-gray-50 transition-colors">
            <GitCompare className="w-5 h-5 text-gray-600" />
          </button>
          <button className="hidden sm:flex w-10 h-10 rounded-full border border-black/10 items-center justify-center hover:bg-gray-50 transition-colors">
            <SlidersHorizontal className="w-5 h-5 text-gray-600" />
          </button>
          <button className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Share2 className="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" />
          </button>
          <button
            onClick={toggleWatchlist}
            className={`relative w-9 sm:w-10 h-9 sm:h-10 rounded-full border flex items-center justify-center transition-colors ${
              isInWatchlist
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-black/10 hover:bg-gray-50'
            }`}
          >
            <Star
              className={`w-4 sm:w-5 h-4 sm:h-5 ${isInWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`}
            />
            {/* Watchlist tooltip */}
            <span className="absolute -top-8 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 pointer-events-none whitespace-nowrap">
              Watchlist
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Left Column - Watch Image */}
        <div className="w-full lg:w-[320px] flex flex-col gap-4 sm:gap-6">
          {/* Watch Image Card */}
          <div className="bg-gradient-to-b from-white to-gray-100 rounded-2xl border border-black/5 p-6 sm:p-8 flex items-center justify-center aspect-square max-w-[320px] mx-auto lg:mx-0 w-full">
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

          {/* Price Range */}
          <div className="flex items-center justify-between max-w-[320px] mx-auto lg:mx-0 w-full">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Market Price</p>
              <p className="text-base sm:text-lg font-semibold text-gray-900">
                €{watchDetails.priceData.minPrice.toLocaleString()} - €{watchDetails.priceData.maxPrice.toLocaleString()}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${
              watchDetails.priceData.priceChange >= 0 ? 'bg-green-600/5' : 'bg-red-600/5'
            }`}>
              {watchDetails.priceData.priceChange >= 0 ? (
                <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-3 sm:w-4 h-3 sm:h-4 text-red-600" />
              )}
              <span className={`text-xs sm:text-sm font-semibold ${
                watchDetails.priceData.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(watchDetails.priceData.priceChange * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 sm:gap-4 max-w-[320px] mx-auto lg:mx-0 w-full">
            <button
              onClick={() => handlePlaceOrder('buy')}
              className="flex-1 h-10 sm:h-12 bg-green-600 text-white text-sm sm:text-base font-semibold rounded-full hover:bg-green-700 transition-colors"
            >
              Place Buy Order
            </button>
            <button
              onClick={() => handlePlaceOrder('sell')}
              className="flex-1 h-10 sm:h-12 bg-red-500 text-white text-sm sm:text-base font-semibold rounded-full hover:bg-red-600 transition-colors"
            >
              Place Sell Order
            </button>
          </div>
        </div>

        {/* Right Column - Charts and Order Book */}
        <div className="flex-1 flex flex-col gap-6 sm:gap-8">
          {/* Price Stats */}
          <div className="flex flex-col sm:flex-row border border-black/5 rounded-2xl overflow-hidden">
            <div className="flex-1 p-4 sm:p-6 text-center border-b sm:border-b-0 sm:border-r border-black/5">
              <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                {watchDetails.priceData.bestBid.toLocaleString()}€
              </p>
              <p className="text-xs sm:text-sm text-gray-500">Best Bid</p>
            </div>
            <div className="flex-1 p-4 sm:p-6 text-center border-b sm:border-b-0 sm:border-r border-black/5">
              <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                {watchDetails.priceData.bestAsk.toLocaleString()}€
              </p>
              <p className="text-xs sm:text-sm text-gray-500">Best Ask</p>
            </div>
            <div className="flex-1 p-4 sm:p-6 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                {watchDetails.priceData.spread.toLocaleString()}€
              </p>
              <p className="text-xs sm:text-sm text-gray-500">Spread</p>
            </div>
          </div>

          {/* Price Chart */}
          <div className="flex-1">
            {/* Chart Placeholder */}
            <div className="h-[150px] sm:h-[200px] mb-4 relative">
              {/* Price tooltip */}
              <div className="absolute top-2 sm:top-4 right-1/4 bg-gray-900 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex items-center gap-1 sm:gap-2">
                <span className="font-semibold">€{watchDetails.priceData.currentPrice.toLocaleString()}</span>
                <span className="text-gray-400 hidden sm:inline">{new Date().toLocaleDateString()}</span>
              </div>
              {/* Simple chart visualization */}
              <svg viewBox="0 0 400 150" className="w-full h-full">
                <path
                  d="M0,120 Q30,115 60,110 T120,100 T180,80 T240,90 T300,60 T360,50 T400,40"
                  fill="none"
                  stroke="#1D1D1F"
                  strokeWidth="2"
                />
                {/* Current price dot */}
                <circle cx="340" cy="45" r="6" fill="#1D1D1F" />
              </svg>
              {/* Y-axis labels */}
              <div className="absolute right-0 top-0 h-full flex flex-col justify-between text-[10px] sm:text-xs text-gray-500">
                <span>€{(watchDetails.priceData.maxPrice / 1000).toFixed(1)}K</span>
                <span>€{(watchDetails.priceData.currentPrice / 1000).toFixed(1)}K</span>
                <span>€{(watchDetails.priceData.minPrice / 1000).toFixed(1)}K</span>
              </div>
            </div>

            {/* Period Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors shrink-0 ${
                    selectedPeriod === period
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Order Book */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Order Book</h2>
              <button
                onClick={() => setShowFullOrderBook(true)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
              >
                See Order Book
                <span className="text-lg">→</span>
              </button>
            </div>

            {/* Order Book Tabs */}
            <div className="flex bg-gray-100 rounded-full p-1 mb-4">
              <button
                onClick={() => setOrderBookTab('buy')}
                className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                  orderBookTab === 'buy'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Buy ({orderBook.filter(o => o.order_type === 'buy').length})
              </button>
              <button
                onClick={() => setOrderBookTab('sell')}
                className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                  orderBookTab === 'sell'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Sell ({orderBook.filter(o => o.order_type === 'sell').length})
              </button>
            </div>

            {/* Order Book Table */}
            <div className="border border-black/5 rounded-2xl overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center px-3 sm:px-6 py-2 sm:py-3 bg-gray-50/50 text-xs sm:text-sm font-medium text-gray-500">
                <span className="w-[70px] sm:w-[100px]">Market</span>
                <span className="w-[60px] sm:w-[100px]">Date</span>
                <span className="flex-1">Condition</span>
                <span className="w-[80px] sm:w-[100px] text-right">Price</span>
              </div>

              {/* Table Rows */}
              <div className="max-h-[250px] sm:max-h-[300px] overflow-y-auto">
                {filteredOrderBook.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No {orderBookTab} orders available
                  </div>
                ) : (
                  filteredOrderBook.map((entry, index) => (
                    <div
                      key={entry.id}
                      onClick={() => navigate(`/app/order/${entry.id}`)}
                      className={`flex items-center px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                        index < filteredOrderBook.length - 1 ? 'border-b border-black/5' : ''
                      }`}
                    >
                      <span className="w-[70px] sm:w-[100px] flex items-center gap-1 sm:gap-2">
                        <span>{entry.flag}</span>
                        <span className="text-gray-900">{entry.market}</span>
                      </span>
                      <span className="w-[60px] sm:w-[100px] text-gray-600">{entry.date}</span>
                      <span className="flex-1 text-gray-600">{entry.condition}</span>
                      <span className={`w-[80px] sm:w-[100px] text-right font-semibold ${
                        orderBookTab === 'buy' ? 'text-green-600' : 'text-red-500'
                      }`}>
                        €{entry.price.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Creation Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Place {orderFormData.order_type === 'buy' ? 'Buy' : 'Sell'} Order
                </h2>
                <p className="text-sm text-gray-500">
                  {watchDetails.brand} {watchDetails.model}
                </p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              {orderError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {orderError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ({watchDetails.currency}) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={orderFormData.price}
                  onChange={(e) => setOrderFormData({ ...orderFormData, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={orderFormData.condition}
                    onChange={(e) => setOrderFormData({ ...orderFormData, condition: e.target.value as 'Unworn' | 'Used' })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="Unworn">Unworn</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={orderFormData.country_code}
                    onChange={(e) => setOrderFormData({ ...orderFormData, country_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_box"
                    checked={orderFormData.has_box}
                    onChange={(e) => setOrderFormData({ ...orderFormData, has_box: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="has_box" className="ml-2 text-sm text-gray-700">Has Box</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_papers"
                    checked={orderFormData.has_papers}
                    onChange={(e) => setOrderFormData({ ...orderFormData, has_papers: e.target.checked })}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="has_papers" className="ml-2 text-sm text-gray-700">Has Papers</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Any additional details..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOrder}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                    orderFormData.order_type === 'buy'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {savingOrder ? 'Placing Order...' : `Place ${orderFormData.order_type === 'buy' ? 'Buy' : 'Sell'} Order`}
                </button>
              </div>
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
              <h2 className="text-xl font-semibold text-gray-900">Order Book</h2>
              <button
                onClick={() => setShowFullOrderBook(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Watch Info */}
            <div className="px-6 py-4 border-b flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {watchDetails.image ? (
                  <img
                    src={watchDetails.image}
                    alt={watchDetails.model}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder width={48} height={48} borderRadius={8} />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{watchDetails.brand} {watchDetails.model}</p>
                <p className="text-sm text-gray-500">
                  €{watchDetails.priceData.minPrice.toLocaleString()} - €{watchDetails.priceData.maxPrice.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Order Book Tabs */}
            <div className="px-6 pt-4 shrink-0">
              <div className="flex bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setOrderBookTab('buy')}
                  className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                    orderBookTab === 'buy'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderBookTab('sell')}
                  className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                    orderBookTab === 'sell'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Order Book Table */}
            <div className="flex-1 overflow-hidden px-6 py-4">
              {/* Table Header */}
              <div className="flex items-center py-3 text-sm font-medium text-gray-500 border-b">
                <span className="w-[100px]">Market</span>
                <span className="w-[100px]">Date</span>
                <span className="flex-1">Condition</span>
                <span className="w-[100px] text-right">Price</span>
              </div>

              {/* Table Rows */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 280px)' }}>
                {filteredOrderBook.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    No {orderBookTab} orders available
                  </div>
                ) : (
                  filteredOrderBook.map((entry, index) => (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setShowFullOrderBook(false);
                        navigate(`/app/order/${entry.id}`);
                      }}
                      className={`flex items-center py-3 text-sm ${
                        index < filteredOrderBook.length - 1 ? 'border-b border-gray-100' : ''
                      } hover:bg-gray-50 cursor-pointer`}
                    >
                      <span className="w-[100px] flex items-center gap-2">
                        <span>{entry.flag}</span>
                        <span className="text-gray-900">{entry.market}</span>
                      </span>
                      <span className="w-[100px] text-gray-600">{entry.date}</span>
                      <span className="flex-1 text-gray-900">{entry.condition}</span>
                      <span className={`w-[100px] text-right font-semibold ${
                        orderBookTab === 'buy' ? 'text-green-600' : 'text-red-500'
                      }`}>
                        €{entry.price.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
