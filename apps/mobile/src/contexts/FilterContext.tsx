import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

interface FilterContextType {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  toggleFilterItem: (key: keyof FilterState, item: string) => void;
  resetFilters: () => void;
  resetFilterCategory: (key: keyof FilterState) => void;
  getFilterCount: (key: keyof FilterState) => number;
  getTotalFilterCount: () => number;
  hasActiveFilters: () => boolean;
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

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

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

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilter,
        toggleFilterItem,
        resetFilters,
        resetFilterCategory,
        getFilterCount,
        getTotalFilterCount,
        hasActiveFilters,
      }}
    >
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
