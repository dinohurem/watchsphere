import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '@/services/api';

// Types for listing fields
export interface ListingFieldValue {
  value: string;
  label: string;
  is_enabled: boolean;
  display_order: number;
  parent_value?: string | null;
}

export interface ListingField {
  key: string;
  name: string;
  field_type: 'dropdown' | 'text' | 'number' | 'multi_select' | 'textarea';
  is_required: boolean;
  display_order: number;
  category: string;
  parent_field_key?: string | null;
  placeholder?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  values: ListingFieldValue[];
}

// Types for filters
export interface FilterValue {
  value: string;
  label: string;
  is_enabled: boolean;
  display_order: number;
}

export interface Filter {
  key: string;
  name: string;
  filter_type: 'multi_select' | 'single_select' | 'range' | 'text' | 'boolean';
  is_searchable: boolean;
  display_order: number;
  ui_section?: string | null;
  range_min?: number | null;
  range_max?: number | null;
  range_step?: number | null;
  placeholder?: string | null;
  values: FilterValue[];
}

// Simple option type for dropdowns
export interface Option {
  value: string;
  label: string;
}

// Category type for listing fields (maps to steps in create listing)
export type FieldCategory = 'basic' | 'caliber' | 'case' | 'bracelet';

// Step mapping for categories
export const CATEGORY_STEPS: Record<FieldCategory, { step: number; title: string }> = {
  basic: { step: 1, title: 'Basic information' },
  caliber: { step: 2, title: 'Caliber information' },
  case: { step: 3, title: 'Case information' },
  bracelet: { step: 4, title: 'Bracelet/Strap information' },
};

interface ConfigContextType {
  // Data
  listingFields: ListingField[];
  marketFilters: Filter[];
  socialFilters: Filter[];
  orderBookFilters: Filter[];

  // Loading states (separate for each type)
  isLoadingListingFields: boolean;
  isLoadingMarketFilters: boolean;
  isLoadingSocialFilters: boolean;
  isLoadingOrderBookFilters: boolean;

  // Combined loading state
  isLoading: boolean;
  error: string | null;

  // Load functions - always fetch fresh from API
  loadListingFields: () => Promise<void>;
  loadMarketFilters: () => Promise<void>;
  loadSocialFilters: () => Promise<void>;
  loadOrderBookFilters: () => Promise<void>;

  // Helper functions
  getFieldByKey: (key: string) => ListingField | undefined;
  getFieldOptions: (key: string, parentValue?: string) => Option[];
  isFieldEnabled: (key: string) => boolean;
  getFieldsByCategory: (category: FieldCategory) => ListingField[];
  getFilterByKey: (category: 'market' | 'social' | 'order_book', key: string) => Filter | undefined;
  getFilterOptions: (category: 'market' | 'social' | 'order_book', key: string) => Option[];
  getFilterConfig: (category: 'market' | 'social' | 'order_book') => Filter[];

  // Refresh function
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [listingFields, setListingFields] = useState<ListingField[]>([]);
  const [marketFilters, setMarketFilters] = useState<Filter[]>([]);
  const [socialFilters, setSocialFilters] = useState<Filter[]>([]);
  const [orderBookFilters, setOrderBookFilters] = useState<Filter[]>([]);

  const [isLoadingListingFields, setIsLoadingListingFields] = useState(false);
  const [isLoadingMarketFilters, setIsLoadingMarketFilters] = useState(false);
  const [isLoadingSocialFilters, setIsLoadingSocialFilters] = useState(false);
  const [isLoadingOrderBookFilters, setIsLoadingOrderBookFilters] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Load listing fields - always fetch fresh from API
  const loadListingFields = useCallback(async () => {
    setIsLoadingListingFields(true);
    setError(null);

    try {
      const response = await api.get('/listing-fields', { timeout: 15000 });
      const fields = response.data || [];
      setListingFields(fields);
    } catch (err: any) {
      console.error('Error loading listing fields:', err);
      setError(err.message || 'Failed to load listing fields');
    } finally {
      setIsLoadingListingFields(false);
    }
  }, []);

  // Load market filters - always fetch fresh from API
  const loadMarketFilters = useCallback(async () => {
    setIsLoadingMarketFilters(true);
    setError(null);

    try {
      const response = await api.get('/filters/market');
      const filters = response.data || [];
      setMarketFilters(filters);
    } catch (err: any) {
      console.error('Error loading market filters:', err);
      setError(err.message || 'Failed to load market filters');
    } finally {
      setIsLoadingMarketFilters(false);
    }
  }, []);

  // Load social filters - always fetch fresh from API
  const loadSocialFilters = useCallback(async () => {
    setIsLoadingSocialFilters(true);
    setError(null);

    try {
      const response = await api.get('/filters/social');
      const filters = response.data || [];
      setSocialFilters(filters);
    } catch (err: any) {
      console.error('Error loading social filters:', err);
      setError(err.message || 'Failed to load social filters');
    } finally {
      setIsLoadingSocialFilters(false);
    }
  }, []);

  // Load order book filters - always fetch fresh from API
  const loadOrderBookFilters = useCallback(async () => {
    setIsLoadingOrderBookFilters(true);
    setError(null);

    try {
      const response = await api.get('/filters/order-book');
      const filters = response.data || [];
      setOrderBookFilters(filters);
    } catch (err: any) {
      console.error('Error loading order book filters:', err);
      setError(err.message || 'Failed to load order book filters');
    } finally {
      setIsLoadingOrderBookFilters(false);
    }
  }, []);

  // Helper function to get field by key
  const getFieldByKey = useCallback((key: string): ListingField | undefined => {
    return listingFields.find(f => f.key === key);
  }, [listingFields]);

  // Helper function to get field options
  const getFieldOptions = useCallback((key: string, parentValue?: string): Option[] => {
    const field = listingFields.find(f => f.key === key);
    if (!field) return [];

    let values = field.values.filter(v => v.is_enabled);

    // If parentValue is provided and field has parent_field_key, filter by parent_value
    // The form may store a label (e.g. "Rolex") while parent_value is a key (e.g. "rolex"),
    // so we match case-insensitively against both value and label of the parent field.
    if (parentValue && field.parent_field_key) {
      const parentField = listingFields.find(f => f.key === field.parent_field_key);
      const parentEntry = parentField?.values.find(
        v => v.label === parentValue || v.value === parentValue
      );
      const normalizedParent = parentEntry?.value || parentValue;
      values = values.filter(v =>
        v.parent_value?.toLowerCase() === normalizedParent.toLowerCase()
      );
    }

    return values
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({ value: v.value, label: v.label }));
  }, [listingFields]);

  // Helper function to check if a field is enabled
  const isFieldEnabled = useCallback((key: string): boolean => {
    // If listing fields haven't loaded yet, default to showing the field
    if (listingFields.length === 0) {
      return true;
    }
    // If field doesn't exist in config, it means it was filtered out (disabled)
    // Return false for missing fields - only enabled fields are returned by the API
    const field = listingFields.find(f => f.key === key);
    return field !== undefined;
  }, [listingFields]);

  // Helper function to get fields by category (for dynamic step rendering)
  const getFieldsByCategory = useCallback((category: FieldCategory): ListingField[] => {
    return listingFields
      .filter(f => f.category === category)
      .sort((a, b) => a.display_order - b.display_order);
  }, [listingFields]);

  // Helper function to get filter by key
  const getFilterByKey = useCallback((
    category: 'market' | 'social' | 'order_book',
    key: string
  ): Filter | undefined => {
    const filters = category === 'market' ? marketFilters :
                    category === 'social' ? socialFilters : orderBookFilters;
    return filters.find(f => f.key === key);
  }, [marketFilters, socialFilters, orderBookFilters]);

  // Helper function to get filter options
  const getFilterOptions = useCallback((
    category: 'market' | 'social' | 'order_book',
    key: string
  ): Option[] => {
    const filter = getFilterByKey(category, key);
    if (!filter) return [];

    return filter.values
      .filter(v => v.is_enabled)
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({ value: v.value, label: v.label }));
  }, [getFilterByKey]);

  // Helper function to get all filters for a category
  const getFilterConfig = useCallback((category: 'market' | 'social' | 'order_book'): Filter[] => {
    const filters = category === 'market' ? marketFilters :
                    category === 'social' ? socialFilters : orderBookFilters;
    return filters.sort((a, b) => a.display_order - b.display_order);
  }, [marketFilters, socialFilters, orderBookFilters]);

  // Refresh all config (reload from API)
  const refreshConfig = useCallback(async () => {
    // Clear state first
    setListingFields([]);
    setMarketFilters([]);
    setSocialFilters([]);
    setOrderBookFilters([]);

    // Reload all from API
    await Promise.all([
      loadListingFields(),
      loadMarketFilters(),
      loadSocialFilters(),
      loadOrderBookFilters(),
    ]);
  }, [loadListingFields, loadMarketFilters, loadSocialFilters, loadOrderBookFilters]);

  // Combined loading state
  const isLoading = isLoadingListingFields || isLoadingMarketFilters ||
                    isLoadingSocialFilters || isLoadingOrderBookFilters;

  return (
    <ConfigContext.Provider
      value={{
        listingFields,
        marketFilters,
        socialFilters,
        orderBookFilters,
        isLoadingListingFields,
        isLoadingMarketFilters,
        isLoadingSocialFilters,
        isLoadingOrderBookFilters,
        isLoading,
        error,
        loadListingFields,
        loadMarketFilters,
        loadSocialFilters,
        loadOrderBookFilters,
        getFieldByKey,
        getFieldOptions,
        isFieldEnabled,
        getFieldsByCategory,
        getFilterByKey,
        getFilterOptions,
        getFilterConfig,
        refreshConfig,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

// Legacy helper to convert labels to options (for backwards compatibility)
export function labelsToOptions(labels: string[]): Option[] {
  return labels.map(label => ({
    value: label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    label,
  }));
}
