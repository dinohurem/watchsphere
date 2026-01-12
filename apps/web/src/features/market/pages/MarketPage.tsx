import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/services/api';
import { SlidersHorizontal, Heart, ChevronDown } from 'lucide-react';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { SubscriptionOverlay } from '@/components/subscription/SubscriptionOverlay';

interface WatchData {
  id: string;
  reference: string;
  brand: string;
  model: string;
  price: number;
  priceChange: number;
  priceHistory?: number[];
  image_url?: string;
  condition?: string;
  year?: number;
  location?: string;
}

// Dynamic filter state based on filter keys
interface DynamicFilterState {
  [key: string]: string[];
}

// Mini chart component for price trend visualization
function MiniChart({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) {
    // Generate placeholder data
    data = positive
      ? [40, 45, 42, 50, 48, 55, 52, 60]
      : [60, 55, 58, 50, 52, 45, 48, 40];
  }

  const height = 32;
  const width = 80;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? '#22C55E' : '#EF4444';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Trending watch card component
function TrendingWatchCard({ watch, onAddToWatchlist, onClick }: {
  watch: WatchData;
  onAddToWatchlist: (id: string) => void;
  onClick: () => void;
}) {
  const isPositive = (watch.priceChange || 0) >= 0;

  return (
    <div
      className="bg-white rounded-2xl p-4 border border-gray-200 min-w-[220px] cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
          {watch.image_url ? (
            <img src={watch.image_url} alt={watch.model} className="w-full h-full object-cover" />
          ) : (
            <ImagePlaceholder size={48} />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToWatchlist(watch.id);
          }}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Heart className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="mb-2">
        <p className="text-sm text-gray-500">{watch.brand}</p>
        <p className="font-semibold text-gray-900 truncate">{watch.model}</p>
        <p className="text-xs text-gray-400">{watch.reference}</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-bold text-lg text-gray-900">€{watch.price?.toLocaleString() || '0'}</p>
        <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{watch.priceChange?.toFixed(1) || '0.0'}%
        </span>
      </div>
    </div>
  );
}

// Market activity row component
function MarketActivityRow({ watch, onClick }: { watch: WatchData; onClick: () => void }) {
  const isPositive = (watch.priceChange || 0) >= 0;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={onClick}>
      <td className="py-4 px-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
            {watch.image_url ? (
              <img src={watch.image_url} alt={watch.model} className="w-full h-full object-cover" />
            ) : (
              <ImagePlaceholder size={32} />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{watch.brand} {watch.model}</p>
            <p className="text-sm text-gray-500">{watch.reference}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <MiniChart data={watch.priceHistory || []} positive={isPositive} />
      </td>
      <td className="py-4 px-4">
        <span className={`font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{watch.priceChange?.toFixed(2) || '0.00'}%
        </span>
      </td>
      <td className="py-4 px-4">
        <span className="font-semibold text-gray-900">€{watch.price?.toLocaleString() || '0'}</span>
      </td>
      <td className="py-4 px-4">
        <button
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View details
        </button>
      </td>
    </tr>
  );
}

export function MarketPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [watches, setWatches] = useState<WatchData[]>([]);
  const [trendingWatches, setTrendingWatches] = useState<WatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('hot');

  // Dynamic filter state (from URL params)
  const [filters, setFilters] = useState<DynamicFilterState>({});

  // Initialize filters from URL params
  useEffect(() => {
    const initialFilters: DynamicFilterState = {};
    searchParams.forEach((value, key) => {
      initialFilters[key] = value.split(',');
    });
    setFilters(initialFilters);
  }, [searchParams]);

  const categories = [
    { key: 'hot', label: 'Hot' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
    { key: 'new', label: 'New' },
    { key: 'trending', label: 'Trending' },
  ];

  useEffect(() => {
    loadWatches();
  }, [selectedCategory]);

  const loadWatches = async () => {
    setLoading(true);
    try {
      const response = await api.get('/market/aggregated', {
        params: {
          category: selectedCategory,
          limit: 50
        }
      });

      if (response.data && response.data.length > 0) {
        const watchData = response.data.map((item: any) => ({
          id: item.reference,
          reference: item.reference,
          brand: item.brand,
          model: item.model,
          price: item.display_price || 0,
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || [],
          image_url: item.image_url,
          condition: item.condition,
        }));
        setWatches(watchData);
        // Use first 4 watches for trending section
        setTrendingWatches(watchData.slice(0, 4));
      } else {
        const fallbackResponse = await api.get('/market');
        const fallbackData = (fallbackResponse.data || []).map((item: any) => ({
          id: item.reference || item.id,
          reference: item.reference,
          brand: item.brand,
          model: item.model,
          price: item.price || item.display_price || 0,
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || [],
          image_url: item.image_url || item.cover_image,
          condition: item.condition,
        }));
        setWatches(fallbackData);
        setTrendingWatches(fallbackData.slice(0, 4));
      }
    } catch (error) {
      console.error('Failed to load watches:', error);
      setWatches([]);
      setTrendingWatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to watches
  const filteredWatches = useMemo(() => {
    return watches.filter(watch => {
      // Check brand filter
      const brandFilter = filters['brand'] || [];
      if (brandFilter.length > 0 && !brandFilter.includes(watch.brand)) {
        return false;
      }

      // Check condition filter
      const conditionFilter = filters['condition'] || [];
      if (conditionFilter.length > 0 && watch.condition && !conditionFilter.includes(watch.condition)) {
        return false;
      }

      // Add more filter checks as needed based on dynamic filter keys
      return true;
    });
  }, [watches, filters]);

  const handleAddToWatchlist = async (watchId: string) => {
    try {
      await api.post('/watchlist', { watchId });
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
    }
  };

  const handleWatchClick = (watch: WatchData) => {
    navigate(`/app/watch/${watch.reference}`);
  };

  const handleOpenFilters = () => {
    // Navigate to filters page with current filters as params
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.set(key, values.join(','));
      }
    });
    navigate(`/app/market/filters${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Count active filters
  const activeFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  return (
    <SubscriptionOverlay feature="market">
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Trending Watches Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Trending Watches</h2>
            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              View all
              <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
            {loading ? (
              // Loading skeleton
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200 min-w-[220px] animate-pulse">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-32 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
                  <div className="h-6 bg-gray-200 rounded w-20" />
                </div>
              ))
            ) : (
              trendingWatches.map((watch) => (
                <TrendingWatchCard
                  key={watch.id}
                  watch={watch}
                  onAddToWatchlist={handleAddToWatchlist}
                  onClick={() => handleWatchClick(watch)}
                />
              ))
            )}
          </div>
        </div>

        {/* Market Activity Section */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900">Market Activity</h2>

              <div className="flex items-center gap-3">
                {/* Category Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {categories.map((category) => (
                    <button
                      key={category.key}
                      onClick={() => setSelectedCategory(category.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === category.key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                {/* Filter Button */}
                <button
                  onClick={handleOpenFilters}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    activeFilterCount > 0
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Market Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-500">Watch</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-500">Chart</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-500">% Change</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-500">Price</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Loading skeleton rows
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
                          <div>
                            <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-gray-200 rounded w-16 animate-pulse" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-10 bg-gray-200 rounded w-24 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredWatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      {activeFilterCount > 0 ? 'No watches match your filters' : 'No watches found'}
                    </td>
                  </tr>
                ) : (
                  filteredWatches.map((watch) => (
                    <MarketActivityRow
                      key={watch.id}
                      watch={watch}
                      onClick={() => handleWatchClick(watch)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </SubscriptionOverlay>
  );
}
