import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Check } from 'lucide-react';
import { useMarketFilters, Filter } from '@/hooks/useConfig';

interface DynamicFilterState {
  [key: string]: string[];
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

export function FiltersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if we came from watch details page
  const fromWatchDetails = location.state?.fromWatchDetails;
  const watchId = location.state?.watchId;

  // Fetch dynamic market filters from backend
  const { data: marketFilters = [], isLoading: isLoadingFilters } = useMarketFilters();

  // Filter state
  const [filters, setFilters] = useState<DynamicFilterState>({});
  const [selectedFilterKey, setSelectedFilterKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize filters from URL params
  useEffect(() => {
    const initialFilters: DynamicFilterState = {};
    searchParams.forEach((value, key) => {
      if (key !== 'selected') {
        initialFilters[key] = value.split(',');
      }
    });
    setFilters(initialFilters);

    // Check if a filter is pre-selected
    const preSelected = searchParams.get('selected');
    if (preSelected) {
      setSelectedFilterKey(preSelected);
    }
  }, [searchParams]);

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
    if (!searchQuery.trim() || !selectedFilter.is_searchable) return enabledValues;
    const query = searchQuery.toLowerCase();
    return enabledValues.filter((v) => v.label.toLowerCase().includes(query));
  }, [selectedFilter, searchQuery]);

  const toggleValue = (filterKey: string, value: string) => {
    setFilters((prev) => {
      const current = prev[filterKey] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [filterKey]: updated };
    });
  };

  const handleReset = () => {
    setFilters({});
  };

  const handleSave = () => {
    // Build URL params from filters
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.set(key, values.join(','));
      }
    });

    // Navigate back to the appropriate page with filters
    if (fromWatchDetails && watchId) {
      // Navigate back to watch details with filters in state
      navigate(`/app/watch/${encodeURIComponent(watchId)}`, {
        state: { filters }
      });
    } else {
      // Navigate back to market with filters as URL params
      navigate(`/app/market${params.toString() ? `?${params.toString()}` : ''}`);
    }
  };

  // Count total active filters
  const totalFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  if (isLoadingFilters) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="px-8 lg:px-16 py-8 lg:py-10 min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto">
      <div className="flex h-[calc(100vh-80px-80px)] bg-white overflow-hidden">
      {/* Left Sidebar - Filter List */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col pr-6">
        {/* Header */}
        <div className="pb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-semibold text-[#1d1d1f]">Filters</h1>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleReset}
                disabled={totalFilterCount === 0}
                className={`px-5 py-2.5 text-[14px] font-medium rounded-full border transition-colors ${
                  totalFilterCount === 0
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-[#1d1d1f] text-[#1d1d1f] hover:bg-gray-50'
                }`}
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#1d1d1f] rounded-full hover:bg-black transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Filter List */}
        <div className="flex-1 overflow-y-auto">
          {/* Basic filters (no section title) */}
          {filtersBySection.basic.map((filter) => {
            const count = filters[filter.key]?.length || 0;
            const isSelected = selectedFilterKey === filter.key;

            return (
              <button
                key={filter.key}
                onClick={() => {
                  setSelectedFilterKey(filter.key);
                  setSearchQuery('');
                }}
                className={`w-full text-left py-[10px] px-3 text-[15px] transition-colors rounded-lg ${
                  isSelected
                    ? 'bg-[rgba(0,0,0,0.05)] text-[#1d1d1f] font-medium'
                    : 'text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.02)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{filter.name}</span>
                  {count > 0 && (
                    <span className="bg-[#1d1d1f] text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
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
                <div key={sectionKey} className="mt-6">
                  <h3 className="text-[15px] font-bold text-[#1d1d1f] pb-3">
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
                          setSearchQuery('');
                        }}
                        className={`w-full text-left py-[10px] px-3 text-[15px] transition-colors rounded-lg ${
                          isSelected
                            ? 'bg-[rgba(0,0,0,0.05)] text-[#1d1d1f] font-medium'
                            : 'text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.02)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{filter.name}</span>
                          {count > 0 && (
                            <span className="bg-[#1d1d1f] text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
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
        </div>
      </div>

      {/* Right Content - Filter Values */}
      <div className="flex-1 flex flex-col pl-12">
        {selectedFilter ? (
          <>
            {/* Filter Header */}
            <div className="pb-6">
              <h2 className="text-[22px] font-semibold text-[#1d1d1f] mb-6">{selectedFilter.name}</h2>

              {/* Search */}
              {selectedFilter.is_searchable && (
                <div className="flex items-center gap-3 bg-[#f5f5f7] rounded-full px-5 py-3.5 max-w-[500px]">
                  <Search className="w-[18px] h-[18px] text-[#1d1d1f]/40" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[15px] outline-none placeholder-[#1d1d1f]/40"
                  />
                </div>
              )}
            </div>

            {/* Values Grid */}
            <div className="flex-1 overflow-y-auto pt-2">
              <div className="grid grid-cols-3 gap-x-8 gap-y-1 max-w-[700px]">
                {filteredValues.map((value) => {
                  const isSelected = (filters[selectedFilter.key] || []).includes(value.label);

                  return (
                    <button
                      key={value.value}
                      onClick={() => toggleValue(selectedFilter.key, value.label)}
                      className={`flex items-center gap-3 py-2.5 text-left transition-colors rounded-lg hover:bg-[rgba(0,0,0,0.02)] ${
                        isSelected ? 'bg-[rgba(0,0,0,0.02)]' : ''
                      }`}
                    >
                      <div className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-[#1d1d1f] border-[#1d1d1f]'
                          : 'border-[#1d1d1f]/20'
                      }`}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span className="text-[15px] text-[#1d1d1f]">{value.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Empty state - no filter selected */
          <div className="flex-1 flex items-center justify-center text-[#1d1d1f]/40">
            Select a filter from the left to view options
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
