import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

// Filter types
export interface FilterState {
  // Basic filters
  brands: string[];
  models: string[];
  priceMin: number | null;
  priceMax: number | null;
  years: string[];
  locations: string[];
  references: string[];

  // Condition & Delivery
  deliveryContents: string[];
  availability: string[];
  conditionType: string[]; // New/Used
  condition: string[];

  // Case size
  caseDiameter: string[];
  lugWidth: string[];
  caseThickness: string[];

  // Watch Type
  gender: string[];
  watchType: string[];
  watchStyle: string[];

  // Movement & Functions
  movement: string[];
  functions: string[];

  // Dial
  dialStyle: string[];
  dialColor: string[];

  // Case
  caseMaterial: string[];
  bezelMaterial: string[];
  crystalType: string[];
  waterResistance: string[];

  // Strap/Bracelet
  bandMaterial: string[];
  bandColor: string[];

  // Clasp
  claspMaterial: string[];
  claspType: string[];
}

// Order book specific filters (for Market Details page)
export interface OrderBookFilterState {
  priceMin: number | null;
  priceMax: number | null;
  locations: string[];
  condition: string[];
  hasBox: boolean | null;
  hasPapers: boolean | null;
}

interface FilterContextType {
  // Market filters
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  toggleFilterItem: (key: keyof FilterState, item: string) => void;
  resetFilters: () => void;
  resetFilterCategory: (key: keyof FilterState) => void;
  getFilterCount: (key: keyof FilterState) => number;
  getTotalFilterCount: () => number;
  hasActiveFilters: () => boolean;

  // Order book filters (separate from market filters)
  orderBookFilters: OrderBookFilterState;
  setOrderBookFilter: <K extends keyof OrderBookFilterState>(key: K, value: OrderBookFilterState[K]) => void;
  toggleOrderBookFilterItem: (key: 'locations' | 'condition', item: string) => void;
  resetOrderBookFilters: () => void;
  getOrderBookFilterCount: () => number;
  hasActiveOrderBookFilters: () => boolean;
}

const initialFilterState: FilterState = {
  brands: [],
  models: [],
  priceMin: null,
  priceMax: null,
  years: [],
  locations: [],
  references: [],
  deliveryContents: [],
  availability: [],
  conditionType: [],
  condition: [],
  caseDiameter: [],
  lugWidth: [],
  caseThickness: [],
  gender: [],
  watchType: [],
  watchStyle: [],
  movement: [],
  functions: [],
  dialStyle: [],
  dialColor: [],
  caseMaterial: [],
  bezelMaterial: [],
  crystalType: [],
  waterResistance: [],
  bandMaterial: [],
  bandColor: [],
  claspMaterial: [],
  claspType: [],
};

const initialOrderBookFilterState: OrderBookFilterState = {
  priceMin: null,
  priceMax: null,
  locations: [],
  condition: [],
  hasBox: null,
  hasPapers: null,
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [orderBookFilters, setOrderBookFilters] = useState<OrderBookFilterState>(initialOrderBookFilterState);

  // Market filter functions
  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleFilterItem = useCallback((key: keyof FilterState, item: string) => {
    setFilters(prev => {
      const currentValue = prev[key];
      if (Array.isArray(currentValue)) {
        const newValue = currentValue.includes(item)
          ? currentValue.filter(i => i !== item)
          : [...currentValue, item];
        return { ...prev, [key]: newValue };
      }
      return prev;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  const resetFilterCategory = useCallback((key: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [key]: initialFilterState[key] }));
  }, []);

  const getFilterCount = useCallback((key: keyof FilterState): number => {
    const value = filters[key];
    if (Array.isArray(value)) {
      return value.length;
    }
    if (key === 'priceMin' || key === 'priceMax') {
      return (filters.priceMin !== null || filters.priceMax !== null) ? 1 : 0;
    }
    return 0;
  }, [filters]);

  const getTotalFilterCount = useCallback((): number => {
    let count = 0;
    for (const key in filters) {
      const value = filters[key as keyof FilterState];
      if (Array.isArray(value)) {
        count += value.length;
      }
    }
    // Add 1 for price if either min or max is set
    if (filters.priceMin !== null || filters.priceMax !== null) {
      count += 1;
    }
    return count;
  }, [filters]);

  const hasActiveFilters = useCallback((): boolean => {
    return getTotalFilterCount() > 0;
  }, [getTotalFilterCount]);

  // Order book filter functions
  const setOrderBookFilter = useCallback(<K extends keyof OrderBookFilterState>(key: K, value: OrderBookFilterState[K]) => {
    setOrderBookFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleOrderBookFilterItem = useCallback((key: 'locations' | 'condition', item: string) => {
    setOrderBookFilters(prev => {
      const currentValue = prev[key];
      const newValue = currentValue.includes(item)
        ? currentValue.filter(i => i !== item)
        : [...currentValue, item];
      return { ...prev, [key]: newValue };
    });
  }, []);

  const resetOrderBookFilters = useCallback(() => {
    setOrderBookFilters(initialOrderBookFilterState);
  }, []);

  const getOrderBookFilterCount = useCallback((): number => {
    let count = 0;
    // Count array filters
    count += orderBookFilters.locations.length;
    count += orderBookFilters.condition.length;
    // Add 1 for price range if either is set
    if (orderBookFilters.priceMin !== null || orderBookFilters.priceMax !== null) {
      count += 1;
    }
    // Add 1 for each boolean filter that is set
    if (orderBookFilters.hasBox !== null) count += 1;
    if (orderBookFilters.hasPapers !== null) count += 1;
    return count;
  }, [orderBookFilters]);

  const hasActiveOrderBookFilters = useCallback((): boolean => {
    return getOrderBookFilterCount() > 0;
  }, [getOrderBookFilterCount]);

  const value = useMemo(() => ({
    // Market filters
    filters,
    setFilter,
    toggleFilterItem,
    resetFilters,
    resetFilterCategory,
    getFilterCount,
    getTotalFilterCount,
    hasActiveFilters,
    // Order book filters
    orderBookFilters,
    setOrderBookFilter,
    toggleOrderBookFilterItem,
    resetOrderBookFilters,
    getOrderBookFilterCount,
    hasActiveOrderBookFilters,
  }), [
    filters,
    setFilter,
    toggleFilterItem,
    resetFilters,
    resetFilterCategory,
    getFilterCount,
    getTotalFilterCount,
    hasActiveFilters,
    orderBookFilters,
    setOrderBookFilter,
    toggleOrderBookFilterItem,
    resetOrderBookFilters,
    getOrderBookFilterCount,
    hasActiveOrderBookFilters,
  ]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
