import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { SlidersHorizontal, Star } from 'lucide-react';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { SubscriptionOverlay } from '@/components/subscription/SubscriptionOverlay';

// Triangle Up icon for positive price change (matching Figma)
function TriangleUp({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M6 3L9 9H3L6 3Z" fill="currentColor" />
    </svg>
  );
}

// Triangle Down icon for negative price change (matching Figma)
function TriangleDown({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M6 9L3 3H9L6 9Z" fill="currentColor" />
    </svg>
  );
}

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

// Mini chart component for price trend visualization - matching Figma design
function MiniChart({ data, isPositive = true }: { data?: number[]; isPositive?: boolean }) {
  // Always render container to maintain consistent layout
  if (!data || data.length < 2) {
    return <div style={{ width: 168, height: 50 }} />;
  }

  const height = 50;
  const width = 168;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const chartHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // Create area path for gradient fill
  const areaPoints = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y };
  });
  const areaPath = `M${areaPoints[0].x},${areaPoints[0].y} ${areaPoints.map(p => `L${p.x},${p.y}`).join(' ')} L${width},${height} L0,${height} Z`;

  // Colors based on positive/negative trend
  const strokeColor = isPositive ? '#4aa078' : '#cc6045';
  const gradientId = `market-gradient-${isPositive ? 'green' : 'red'}-${Math.random().toString(36).substr(2, 9)}`;
  const gradientStartColor = isPositive ? 'rgba(74, 160, 120, 0.3)' : 'rgba(204, 96, 69, 0.3)';
  const gradientEndColor = isPositive ? 'rgba(74, 160, 120, 0)' : 'rgba(204, 96, 69, 0)';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={gradientStartColor} />
          <stop offset="100%" stopColor={gradientEndColor} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
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
      className="relative border border-black/5 rounded-2xl overflow-hidden cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors bg-white shrink-0 w-[226px]"
      onClick={onClick}
    >
      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddToWatchlist(watch.id);
        }}
        className="absolute top-2 right-2 w-10 h-10 rounded-full bg-[#f4f4f4] flex items-center justify-center z-10"
      >
        <Star className="w-[17px] h-[17px] text-[#1d1d1f]" fill="currentColor" />
      </button>
      {/* Watch Image */}
      <div className="h-[150px] bg-gradient-to-b from-white to-[#f4f4f4] flex items-center justify-center rounded-t-xl">
        {watch.image_url ? (
          <img src={watch.image_url} alt={watch.model} className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <ImagePlaceholder width={120} height={120} borderRadius={0} />
        )}
      </div>
      {/* Watch Info */}
      <div className="px-4 pb-4 pt-3 flex flex-col gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#212121] leading-[1.3] truncate">{watch.brand} {watch.model}</p>
          <p className="text-[13px] font-medium text-[#212121]/50 leading-[1.3] truncate">{watch.reference}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-[#212121] leading-[1.3]">
            {watch.price?.toLocaleString() || '0'}€
          </p>
          <div className={`flex items-center gap-1 px-[7px] py-[3px] rounded-full ${
            isPositive ? 'bg-[rgba(74,160,120,0.05)]' : 'bg-[rgba(201,57,39,0.05)]'
          }`}>
            {isPositive ? (
              <TriangleUp className="text-[#4aa078]" />
            ) : (
              <TriangleDown className="text-[#c93927]" />
            )}
            <span className={`text-[11px] font-semibold leading-[1.3] font-mono ${
              isPositive ? 'text-[#4aa078]' : 'text-[#c93927]'
            }`}>
              {Math.abs(watch.priceChange || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketPage() {
  const { t } = useTranslation();
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
    { key: 'hot', labelKey: 'market.categories.hot' },
    { key: 'gainers', labelKey: 'market.categories.gainers' },
    { key: 'losers', labelKey: 'market.categories.losers' },
    { key: 'new', labelKey: 'market.categories.new' },
    { key: 'trending', labelKey: 'market.categories.trending' },
  ];

  useEffect(() => {
    loadWatches();
  }, [selectedCategory]);

  // Load featured/trending watches separately on mount
  useEffect(() => {
    loadFeaturedWatches();
  }, []);

  const loadFeaturedWatches = async () => {
    try {
      // Fetch from dedicated featured endpoint
      // Priority: admin-assigned featured → order_count → views
      const response = await api.get('/market/featured', {
        params: { limit: 4 }
      });

      if (response.data && response.data.length > 0) {
        const featured = response.data.map((item: any) => ({
          id: item.id,
          reference: item.reference,
          brand: item.brand,
          model: item.model,
          price: item.price || 0,
          priceChange: item.price_change || 0,
          priceHistory: item.price_history || [],
          image_url: item.cover_image,
          condition: item.condition,
        }));
        setTrendingWatches(featured);
      }
    } catch (error) {
      console.error('Failed to load featured watches:', error);
    }
  };

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
      }
    } catch (error) {
      console.error('Failed to load watches:', error);
      setWatches([]);
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
    const watchIdentifier = watch.reference || watch.id;
    navigate(`/app/watch/${encodeURIComponent(watchIdentifier)}`);
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
    <div className="p-4 lg:p-6 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto flex flex-col gap-16">
        {/* Trending Watches Section */}
        <div className="flex flex-col gap-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">{t('market.trendingWatches')}</h2>

          <div className="flex gap-8 overflow-x-auto pb-2">
            {loading ? (
              // Loading skeleton
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-black/5 overflow-hidden animate-pulse shrink-0 w-[226px]">
                  <div className="h-[150px] bg-gray-200" />
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-gray-200 rounded w-16" />
                      <div className="h-5 bg-gray-200 rounded w-12" />
                    </div>
                  </div>
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
        <div className="flex flex-col gap-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">{t('market.marketActivity')}</h2>

          {/* Filters Row */}
          <div className="flex items-center justify-between">
            {/* Category Tabs */}
            <div className="flex gap-2">
              {categories.map((category) => (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`px-5 py-[11px] rounded-full text-[15px] leading-[20px] tracking-[0.075px] transition-colors ${
                    selectedCategory === category.key
                      ? 'bg-[#212121] text-white font-medium'
                      : 'text-[#212121] font-normal hover:bg-[rgba(29,29,31,0.02)]'
                  }`}
                >
                  {t(category.labelKey)}
                </button>
              ))}
            </div>

            {/* Filter Button */}
            <button
              onClick={handleOpenFilters}
              className="flex items-center gap-1 px-3 py-2 border border-black rounded-full transition-colors hover:bg-[rgba(29,29,31,0.02)]"
            >
              <SlidersHorizontal className="w-[26px] h-[26px]" />
              <span className="text-[15px] font-medium leading-[20px] tracking-[0.075px] text-black">
                {t('market.filters')}
              </span>
            </button>
          </div>

          {/* Market Table */}
          <div className="border border-black/5 rounded-2xl overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block pt-8 px-8 pb-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 pr-6 mb-4">
                <div className="w-[200px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{t('market.table.watch')}</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{t('market.table.chart')}</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{t('market.table.change')}</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{t('market.table.price')}</p>
                </div>
                <div className="w-[129px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{t('market.table.actions')}</p>
                </div>
              </div>
              {/* Rows */}
              <div className="flex flex-col">
                {loading ? (
                  // Loading skeleton rows
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-6 border-b border-[rgba(33,33,33,0.05)]">
                      <div className="w-[200px]">
                        <div className="h-5 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                      </div>
                      <div className="w-[168px]">
                        <div className="w-[100px] h-[40px] bg-gray-200 rounded animate-pulse" />
                      </div>
                      <div className="w-[168px]">
                        <div className="h-5 bg-gray-200 rounded w-16 animate-pulse" />
                      </div>
                      <div className="w-[168px]">
                        <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                      </div>
                      <div className="w-[129px]">
                        <div className="h-[44px] bg-gray-200 rounded-full w-[110px] animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : filteredWatches.length === 0 ? (
                  <div className="py-12 text-center text-[#212121]/50">
                    {activeFilterCount > 0 ? t('market.noMatchingFilters') : t('market.noWatchesFound')}
                  </div>
                ) : (
                  filteredWatches.map((watch, index) => {
                    const isPositive = (watch.priceChange || 0) >= 0;
                    return (
                      <div
                        key={watch.id}
                        className={`flex items-center justify-between gap-3 py-6 cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors ${
                          index < filteredWatches.length - 1 ? 'border-b border-[rgba(33,33,33,0.05)]' : ''
                        }`}
                        onClick={() => handleWatchClick(watch)}
                      >
                        <div className="w-[200px]">
                          <p className="text-base font-semibold text-[#212121] leading-[20px] tracking-[0.08px]">{watch.brand} {watch.model}</p>
                          <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{watch.reference}</p>
                        </div>
                        <div className="w-[168px]">
                          <MiniChart data={watch.priceHistory || []} isPositive={isPositive} />
                        </div>
                        <div className="w-[168px] flex items-center gap-1">
                          {isPositive ? (
                            <TriangleUp className="text-[#4aa078]" />
                          ) : (
                            <TriangleDown className="text-[#cc6045]" />
                          )}
                          <span className={`text-sm font-normal leading-[16px] font-mono ${
                            isPositive ? 'text-[#4aa078]' : 'text-[#cc6045]'
                          }`}>
                            {Math.abs(watch.priceChange || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-[168px]">
                          <p className="text-base font-semibold text-[#212121] leading-[20px] tracking-[0.08px]">
                            €{watch.price?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <div className="w-[129px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWatchClick(watch);
                            }}
                            className="px-5 py-3 bg-[#212121] text-white text-base font-semibold leading-[20px] tracking-[0.08px] rounded-full hover:bg-black transition-colors"
                          >
                            {t('market.viewDetails')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-black/5">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                        <div className="h-3 bg-gray-200 rounded w-20" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-gray-200 rounded w-20" />
                      <div className="h-5 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                ))
              ) : filteredWatches.length === 0 ? (
                <div className="py-12 text-center text-[#212121]/50">
                  {activeFilterCount > 0 ? 'No watches match your filters' : 'No watches found'}
                </div>
              ) : (
                filteredWatches.map((watch) => {
                  const isPositive = (watch.priceChange || 0) >= 0;
                  return (
                    <div
                      key={watch.id}
                      onClick={() => handleWatchClick(watch)}
                      className="p-4 cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#f5f5f7] flex items-center justify-center overflow-hidden shrink-0">
                            {watch.image_url ? (
                              <img src={watch.image_url} alt={watch.brand} className="w-full h-full object-contain" loading="lazy" />
                            ) : (
                              <ImagePlaceholder size={24} />
                            )}
                          </div>
                          <div>
                            <p className="text-base font-semibold text-[#212121]">{watch.brand} {watch.model}</p>
                            <p className="text-sm font-medium text-[#212121]/50">{watch.reference}</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                          isPositive ? 'bg-[rgba(74,160,120,0.05)]' : 'bg-[rgba(201,57,39,0.05)]'
                        }`}>
                          {isPositive ? (
                            <TriangleUp className="text-[#4aa078]" />
                          ) : (
                            <TriangleDown className="text-[#cc6045]" />
                          )}
                          <span className={`text-sm font-medium font-mono ${
                            isPositive ? 'text-[#4aa078]' : 'text-[#cc6045]'
                          }`}>
                            {Math.abs(watch.priceChange || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold text-[#212121]">€{watch.price?.toLocaleString() || '0'}</p>
                        <span className="text-sm font-medium text-[#212121]/50">{t('market.viewDetails')} →</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </SubscriptionOverlay>
  );
}
