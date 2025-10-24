import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Search, SlidersHorizontal, Grid3x3, List } from 'lucide-react';

export function MarketPage() {
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadWatches();
  }, []);

  const loadWatches = async () => {
    try {
      const response = await api.get('/market');
      setWatches(response.data);
    } catch (error) {
      console.error('Failed to load watches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWatches = watches.filter(watch =>
    watch.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    watch.model.toLowerCase().includes(searchQuery.toLowerCase())
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by brand or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Filters and View Toggle */}
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 font-medium transition-colors">
                <SlidersHorizontal className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'} transition-colors`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'} transition-colors`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
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
            {filteredWatches.map((watch) => (
              <div
                key={watch.id}
                className={`bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer ${
                  viewMode === 'list' ? 'flex gap-6 p-6' : 'p-6'
                }`}
              >
                {/* Watch Image Placeholder */}
                <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${
                  viewMode === 'list' ? 'w-32 h-32 flex-shrink-0' : 'w-full h-48 mb-4'
                }`}>
                  <span className="text-4xl">⌚</span>
                </div>

                {/* Watch Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {watch.brand}
                      </h3>
                      <p className="text-gray-600">{watch.model}</p>
                    </div>
                  </div>

                  <p className="text-2xl font-bold text-primary mb-3">
                    ${watch.price.toLocaleString()}
                  </p>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Condition:</span>
                      <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                        {watch.condition}
                      </span>
                    </div>
                    {watch.year && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Year:</span>
                        <span className="text-gray-600">{watch.year}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Dealer:</span>
                      <span className="text-gray-600">{watch.dealer.name}</span>
                      {watch.dealer.verified && (
                        <span className="text-xs text-green-600">✓ Verified</span>
                      )}
                    </div>
                  </div>

                  <button className="mt-4 w-full py-2 px-4 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
