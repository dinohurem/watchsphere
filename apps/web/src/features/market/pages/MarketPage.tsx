import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Search, SlidersHorizontal, Grid3x3, List, Heart, TrendingUp, TrendingDown } from 'lucide-react';

interface WatchData {
  id: string;
  reference: string;
  brand: string;
  model: string;
  price: number;
  priceChange: number;
  condition?: string;
  year?: number;
  location?: string;
  dealer?: {
    name: string;
    verified: boolean;
  };
}

export function MarketPage() {
  const [watches, setWatches] = useState<WatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('hot');

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
      // Use aggregated endpoint with proper pricing logic
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
          // display_price is lowest order price OR admin price
          price: item.display_price || 0,
          priceChange: item.price_change || 0,
        }));
        setWatches(watchData);
      } else {
        // Fallback to old endpoint
        const fallbackResponse = await api.get('/market');
        setWatches(fallbackResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load watches:', error);
      setWatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async (watchId: string) => {
    try {
      await api.post('/watchlist', { watchId });
      // Show success notification
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
    }
  };

  const filteredWatches = watches.filter(watch =>
    watch.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    watch.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    watch.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Market</h1>
          <p className="text-gray-600">Browse watches from verified dealers worldwide</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by brand, model, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base"
              />
            </div>

            {/* Filters and View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-5 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                  showFilters ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {loading ? 'Loading...' : `${filteredWatches.length} watch${filteredWatches.length !== 1 ? 'es' : ''} found`}
          </p>
        </div>

        {/* Watches Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredWatches.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
            <p className="text-gray-600">No watches found. Try adjusting your search.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredWatches.map((watch) => {
              const hasPositiveChange = (watch.priceChange || 0) > 0;

              return (
                <div
                  key={watch.id}
                  className={`bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 group ${
                    viewMode === 'list' ? 'flex gap-6 p-6' : 'overflow-hidden'
                  }`}
                >
                  {/* Watch Image Placeholder */}
                  <div className={`bg-gray-100 flex items-center justify-center ${
                    viewMode === 'list' ? 'w-32 h-32 rounded-lg flex-shrink-0' : 'w-full h-56'
                  }`}>
                    <span className="text-5xl">⌚</span>
                  </div>

                  {/* Watch Details */}
                  <div className={`flex-1 ${viewMode === 'grid' ? 'p-6' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          {watch.brand}
                        </h3>
                        <p className="text-gray-600 font-medium">{watch.model}</p>
                        <p className="text-sm text-gray-500 mt-1">{watch.reference}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToWatchlist(watch.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Add to watchlist"
                      >
                        <Heart className="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <p className="text-3xl font-bold text-gray-900">
                        €{watch.price?.toLocaleString() || 'N/A'}
                      </p>
                      {watch.priceChange !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          {hasPositiveChange ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${
                            hasPositiveChange ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {hasPositiveChange ? '+' : ''}{watch.priceChange.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {watch.condition && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700 capitalize">
                          {watch.condition}
                        </span>
                      )}
                      {watch.year && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                          {watch.year}
                        </span>
                      )}
                      {watch.location && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                          {watch.location}
                        </span>
                      )}
                    </div>

                    {watch.dealer && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <span>Dealer: {watch.dealer.name}</span>
                        {watch.dealer.verified && (
                          <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                        )}
                      </div>
                    )}

                    <button className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
