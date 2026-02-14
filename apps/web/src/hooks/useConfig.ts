import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

// Types for listing fields
export interface ListingFieldValue {
  value: string
  label: string
  is_enabled: boolean
  display_order: number
  parent_value?: string | null
}

export interface ListingField {
  key: string
  name: string
  field_type: 'dropdown' | 'text' | 'number' | 'multi_select' | 'textarea'
  is_required: boolean
  display_order: number
  category: string
  parent_field_key?: string | null
  placeholder?: string | null
  min_value?: number | null
  max_value?: number | null
  values: ListingFieldValue[]
}

// Types for filters
export interface FilterValue {
  value: string
  label: string
  is_enabled: boolean
  display_order: number
}

export interface Filter {
  key: string
  name: string
  filter_type: 'multi_select' | 'single_select' | 'range' | 'text' | 'boolean'
  is_searchable: boolean
  display_order: number
  ui_section?: string | null
  range_min?: number | null
  range_max?: number | null
  range_step?: number | null
  placeholder?: string | null
  values: FilterValue[]
}

// Simple option type for dropdowns
export interface Option {
  value: string
  label: string
}

// Category type for listing fields (maps to steps in create listing)
export type FieldCategory = 'basic' | 'caliber' | 'case' | 'bracelet'

// Step mapping for categories
export const CATEGORY_STEPS: Record<FieldCategory, { step: number; title: string }> = {
  basic: { step: 0, title: 'Basic information' },
  caliber: { step: 1, title: 'Caliber information' },
  case: { step: 2, title: 'Case information' },
  bracelet: { step: 3, title: 'Bracelet/Strap information' },
}

// Fetch functions
const fetchListingFields = async (): Promise<ListingField[]> => {
  const response = await api.get('/listing-fields')
  return response.data || []
}

const fetchMarketFilters = async (): Promise<Filter[]> => {
  const response = await api.get('/filters/market')
  return response.data || []
}

const fetchSocialFilters = async (): Promise<Filter[]> => {
  const response = await api.get('/filters/social')
  return response.data || []
}

const fetchOrderBookFilters = async (): Promise<Filter[]> => {
  const response = await api.get('/filters/order-book')
  return response.data || []
}

// Cache configuration
const STALE_TIME = 1000 * 60 * 5 // 5 minutes (short to ensure fresh data)

export function useListingFields() {
  return useQuery({
    queryKey: ['listing-fields'],
    queryFn: fetchListingFields,
    staleTime: STALE_TIME,
  })
}

export function useMarketFilters() {
  return useQuery({
    queryKey: ['filters', 'market'],
    queryFn: fetchMarketFilters,
    staleTime: STALE_TIME,
  })
}

export function useSocialFilters() {
  return useQuery({
    queryKey: ['filters', 'social'],
    queryFn: fetchSocialFilters,
    staleTime: STALE_TIME,
  })
}

export function useOrderBookFilters() {
  return useQuery({
    queryKey: ['filters', 'order-book'],
    queryFn: fetchOrderBookFilters,
    staleTime: STALE_TIME,
  })
}

// Combined hook with helper functions
export function useConfig() {
  const listingFieldsQuery = useListingFields()
  const marketFiltersQuery = useMarketFilters()
  const socialFiltersQuery = useSocialFilters()
  const orderBookFiltersQuery = useOrderBookFilters()

  const listingFields = listingFieldsQuery.data || []
  const marketFilters = marketFiltersQuery.data || []
  const socialFilters = socialFiltersQuery.data || []
  const orderBookFilters = orderBookFiltersQuery.data || []

  const isLoading =
    listingFieldsQuery.isLoading ||
    marketFiltersQuery.isLoading ||
    socialFiltersQuery.isLoading ||
    orderBookFiltersQuery.isLoading

  const error =
    listingFieldsQuery.error ||
    marketFiltersQuery.error ||
    socialFiltersQuery.error ||
    orderBookFiltersQuery.error

  // Helper function to get field by key
  const getFieldByKey = (key: string): ListingField | undefined => {
    return listingFields.find((f) => f.key === key)
  }

  // Helper function to get field options
  const getFieldOptions = (key: string, parentValue?: string): Option[] => {
    const field = listingFields.find((f) => f.key === key)
    if (!field) return []

    let values = field.values.filter((v) => v.is_enabled)

    // If parentValue is provided and field has parent_field_key, filter by parent_value
    // The form may store a label (e.g. "Rolex") while parent_value is a key (e.g. "rolex"),
    // so we resolve the label to its value key before matching.
    if (parentValue && field.parent_field_key) {
      const parentField = listingFields.find((f) => f.key === field.parent_field_key)
      const parentEntry = parentField?.values.find(
        (v) => v.label === parentValue || v.value === parentValue
      )
      const normalizedParent = parentEntry?.value || parentValue
      values = values.filter(
        (v) => v.parent_value?.toLowerCase() === normalizedParent.toLowerCase()
      )
    }

    return values
      .sort((a, b) => a.display_order - b.display_order)
      .map((v) => ({ value: v.value, label: v.label }))
  }

  // Helper function to check if a field is enabled
  const isFieldEnabled = (key: string): boolean => {
    // If listing fields haven't loaded yet, default to showing the field
    if (listingFields.length === 0) return true
    const field = listingFields.find((f) => f.key === key)
    // If field doesn't exist in config, it means it was filtered out (disabled)
    // Return false for missing fields - only enabled fields are returned by the API
    return field !== undefined
  }

  // Helper function to get fields by category (for dynamic step rendering)
  const getFieldsByCategory = (category: FieldCategory): ListingField[] => {
    return listingFields
      .filter((f) => f.category === category)
      .sort((a, b) => a.display_order - b.display_order)
  }

  // Helper function to get filter by key
  const getFilterByKey = (
    category: 'market' | 'social' | 'order_book',
    key: string
  ): Filter | undefined => {
    const filters =
      category === 'market'
        ? marketFilters
        : category === 'social'
          ? socialFilters
          : orderBookFilters
    return filters.find((f) => f.key === key)
  }

  // Helper function to get filter options
  const getFilterOptions = (category: 'market' | 'social' | 'order_book', key: string): Option[] => {
    const filter = getFilterByKey(category, key)
    if (!filter) return []

    return filter.values
      .filter((v) => v.is_enabled)
      .sort((a, b) => a.display_order - b.display_order)
      .map((v) => ({ value: v.value, label: v.label }))
  }

  // Helper function to get all filters for a category
  const getFilterConfig = (category: 'market' | 'social' | 'order_book'): Filter[] => {
    const filters =
      category === 'market'
        ? marketFilters
        : category === 'social'
          ? socialFilters
          : orderBookFilters
    return filters.sort((a, b) => a.display_order - b.display_order)
  }

  return {
    // Data
    listingFields,
    marketFilters,
    socialFilters,
    orderBookFilters,

    // Loading/error state
    isLoading,
    error,

    // Helper functions
    getFieldByKey,
    getFieldOptions,
    isFieldEnabled,
    getFieldsByCategory,
    getFilterByKey,
    getFilterOptions,
    getFilterConfig,
  }
}
