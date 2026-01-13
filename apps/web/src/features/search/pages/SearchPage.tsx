import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, X, ArrowLeft, Check } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { useMarketFilters, Filter } from '@/hooks/useConfig';

interface WatchResult {
  id: string;
  reference: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  image_url?: string;
  condition?: string;
  year?: number;
}

// Section title mapping
const SECTION_TITLES: Record<string, string> = {
  basic: '',
  watch: '',
  price: '',
  condition: 'Condition & Delivery Contents',
  case_size: 'Case size',
  watch_type: 'Watch Type',
  caliber: 'Movement & Functions',
  dial: 'Dial',
  case: 'Case',
  band: 'Strap / bracelet',
  clasp: 'Clasp',
};

interface DynamicFilterState {
  [key: string]: string[];
}

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<WatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const { data: marketFilters = [], isLoading: isLoadingFilters } = useMarketFilters();
  const [filters, setFilters] = useState<DynamicFilterState>({});
  const [selectedFilterKey, setSelectedFilterKey] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Initialize from URL params
  useEffect(() => {
    const initialFilters: DynamicFilterState = {};
    searchParams.forEach((value, key) => {
      if (key !== 'q') {
        initialFilters[key] = value.split(',');
      }
    });
    setFilters(initialFilters);

    // Auto-search if query present
    if (initialQuery) {
      handleSearch(initialQuery, initialFilters);
    }
  }, []);

  // Group filters by section
  const filtersBySection = useMemo(() => {
    const sections: Record<string, Filter[]> = {
      basic: [],
      condition: [],
      case_size: [],
      watch_type: [],
      caliber: [],
      dial: [],
      case: [],
      band: [],
      clasp: [],
    };

    const sortedFilters = [...marketFilters].sort((a, b) => a.display_order - b.display_order);

    for (const filter of sortedFilters) {
      const uiSection = filter.ui_section || 'watch';
      if (uiSection === 'watch' || uiSection === 'price') {
        sections.basic.push(filter);
      } else if (sections[uiSection]) {
        sections[uiSection].push(filter);
      } else {
        sections.basic.push(filter);
      }
    }

    return sections;
  }, [marketFilters]);

  // Get currently selected filter
  const selectedFilter = useMemo(() => {
    if (!selectedFilterKey) return null;
    return marketFilters.find(f => f.key === selectedFilterKey) || null;
  }, [selectedFilterKey, marketFilters]);

  // Get filtered values for the selected filter
  const filteredValues = useMemo(() => {
    if (!selectedFilter) return [];
    const enabledValues = selectedFilter.values.filter((v) => v.is_enabled);
    if (!filterSearchQuery.trim() || !selectedFilter.is_searchable) return enabledValues;
    const query = filterSearchQuery.toLowerCase();
    return enabledValues.filter((v) => v.label.toLowerCase().includes(query));
  }, [selectedFilter, filterSearchQuery]);

  const handleSearch = async (query: string, currentFilters: DynamicFilterState = filters) => {
    if (!query.trim() && Object.keys(currentFilters).length === 0) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // Build search params
      const params: Record<string, string> = {};
      if (query.trim()) {
        params.q = query.trim();
      }
      Object.entries(currentFilters).forEach(([key, values]) => {
        if (values.length > 0) {
          params[key] = values.join(',');
        }
      });

      const response = await api.get('/market/search', { params });
      setResults(response.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to market data
      try {
        const fallbackResponse = await api.get('/market');
        const filtered = (fallbackResponse.data || []).filter((watch: any) => {
          const searchLower = query.toLowerCase();
          return (
            watch.brand?.toLowerCase().includes(searchLower) ||
            watch.model?.toLowerCase().includes(searchLower) ||
            watch.reference?.toLowerCase().includes(searchLower)
          );
        });
        setResults(filtered);
      } catch (fallbackError) {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    Object.entries(filters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.set(key, values.join(','));
      }
    });
    setSearchParams(params);
    handleSearch(searchQuery);
  };

  const toggleValue = (filterKey: string, value: string) => {
    setFilters((prev) => {
      const current = prev[filterKey] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [filterKey]: updated };
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
    setSearchParams({});
  };

  const handleWatchClick = (watch: WatchResult) => {
    navigate(`/app/watch/${watch.reference || watch.id}`);
  };

  // Count total active filters
  const totalFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  return (
    <div className="flex h-[calc(100vh-83px)] bg-gray-50">
      {/* Left Sidebar - Filters */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
            {totalFilterCount > 0 && (
              <button
                onClick={() => {
                  setFilters({});
                  handleSearch(searchQuery, {});
                }}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filter List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingFilters ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : (
            <>
              {/* Basic filters (no section title) */}
              {filtersBySection.basic.map((filter) => {
                const count = filters[filter.key]?.length || 0;
                const isSelected = selectedFilterKey === filter.key;

                return (
                  <button
                    key={filter.key}
                    onClick={() => {
                      setSelectedFilterKey(filter.key);
                      setFilterSearchQuery('');
                    }}
                    className={`w-full text-left py-3 px-6 text-[15px] transition-colors ${
                      isSelected
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{filter.name}</span>
                      {count > 0 && (
                        <span className="bg-gray-900 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Other sections with titles */}
              {Object.entries(filtersBySection)
                .filter(([key]) => key !== 'basic')
                .map(([sectionKey, sectionFilters]) => {
                  if (sectionFilters.length === 0) return null;
                  return (
                    <div key={sectionKey}>
                      <h3 className="text-[15px] font-bold text-gray-900 px-6 pt-6 pb-2">
                        {SECTION_TITLES[sectionKey]}
                      </h3>
                      {sectionFilters.map((filter) => {
                        const count = filters[filter.key]?.length || 0;
                        const isSelected = selectedFilterKey === filter.key;

                        return (
                          <button
                            key={filter.key}
                            onClick={() => {
                              setSelectedFilterKey(filter.key);
                              setFilterSearchQuery('');
                            }}
                            className={`w-full text-left py-3 px-6 text-[15px] transition-colors ${
                              isSelected
                                ? 'bg-gray-100 text-gray-900 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{filter.name}</span>
                              {count > 0 && (
                                <span className="bg-gray-900 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                  {count}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </div>

      {/* Middle Content - Filter Values or Search Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFilter ? (
          /* Filter Values View */
          <>
            {/* Filter Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setSelectedFilterKey(null)}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-900" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">{selectedFilter.name}</h2>
              </div>

              {/* Search within filter */}
              {selectedFilter.is_searchable && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
                  <Search className="w-[18px] h-[18px] text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[15px] outline-none placeholder-gray-500"
                  />
                </div>
              )}
            </div>

            {/* Values Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-3">
                {filteredValues.map((value) => {
                  const isSelected = (filters[selectedFilter.key] || []).includes(value.label);

                  return (
                    <button
                      key={value.value}
                      onClick={() => toggleValue(selectedFilter.key, value.label)}
                      className={`flex items-center gap-3 py-3 px-4 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-[15px] text-gray-900">{value.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Apply Button */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedFilterKey(null);
                  handleSearch(searchQuery);
                }}
                className="w-full py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </>
        ) : (
          /* Search Results View */
          <>
            {/* Search Header */}
            <div className="p-6 border-b border-gray-200">
              <form onSubmit={handleSubmit} className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-3 bg-gray-100 rounded-full px-5 py-3">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search watches by brand, model, or reference..."
                    className="flex-1 bg-transparent text-[15px] outline-none placeholder-gray-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="p-1 hover:bg-gray-200 rounded-full"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
                >
                  Search
                </button>
              </form>

              {hasSearched && (
                <p className="mt-4 text-sm text-gray-500">
                  {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} found`}
                </p>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : !hasSearched ? (
                <div className="text-center py-20">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for watches</h3>
                  <p className="text-gray-500">
                    Enter a brand, model, or reference number to find watches
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-20">
                  <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {results.map((watch) => (
                    <div
                      key={watch.id}
                      onClick={() => handleWatchClick(watch)}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      {/* Watch Image */}
                      <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                        {watch.image_url ? (
                          <img
                            src={watch.image_url}
                            alt={`${watch.brand} ${watch.model}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <ImagePlaceholder width={160} height={160} borderRadius={0} />
                        )}
                      </div>

                      {/* Watch Info */}
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 mb-0.5">
                          {watch.brand} {watch.model}
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">{watch.reference}</p>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">
                            {watch.currency === 'EUR' ? '€' : watch.currency === 'USD' ? '$' : watch.currency}
                            {watch.price?.toLocaleString() || 'N/A'}
                          </span>
                          {watch.condition && (
                            <span className="text-xs text-gray-500 capitalize">{watch.condition}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
