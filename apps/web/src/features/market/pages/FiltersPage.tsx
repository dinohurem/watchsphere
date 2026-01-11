import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();

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

    // Navigate back to market with filters
    navigate(`/app/market${params.toString() ? `?${params.toString()}` : ''}`);
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
    <div className="p-6 lg:p-8">
      <div className="flex h-[calc(100vh-64px-48px)] lg:h-[calc(100vh-64px-64px)] bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Left Sidebar - Filter List */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Filters</h1>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={totalFilterCount === 0}
                className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                  totalFilterCount === 0
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-gray-900 text-gray-900 hover:bg-gray-50'
                }`}
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition-colors"
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
                          setSearchQuery('');
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
        </div>
      </div>

      {/* Right Content - Filter Values */}
      <div className="flex-1 flex flex-col">
        {selectedFilter ? (
          <>
            {/* Filter Header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedFilter.name}</h2>

              {/* Search */}
              {selectedFilter.is_searchable && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
                  <Search className="w-[18px] h-[18px] text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                        isSelected
                          ? 'bg-gray-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-gray-900 border-gray-900'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span className="text-[15px] text-gray-900">{value.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Empty state - no filter selected */
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a filter from the left to view options
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
