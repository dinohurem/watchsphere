import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig, Filter } from '@/contexts/ConfigContext';
import { BackArrow, Search, MapPin, Calendar, User, ChevronDown, X, Check } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';

interface SocialMessage {
  id: string;
  brand: string | null;
  reference: string | null;
  price: number | null;
  currency: string;
  condition: string | null;
  seller_name: string;
  seller_phone: string | null;
  raw_text: string;
  offer_type: string;
  country_code: string | null;
  country_name: string | null;
  message_timestamp: string | null;
}

// Filter state type based on dynamic filters
interface FilterState {
  [key: string]: string | string[] | null;
}

export default function SocialSearchScreen() {
  const { colors, fonts } = useTheme();
  const { getFilterConfig, getFilterOptions, loadSocialFilters, isLoadingSocialFilters, socialFilters } = useConfig();

  // Screen state: 'filters' or 'results'
  const [screenState, setScreenState] = useState<'filters' | 'results'>('filters');

  // Messages state
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  // Dynamic filter state
  const [filterValues, setFilterValues] = useState<FilterState>({});

  // Dropdown modal state
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState<Filter | null>(null);

  // Load social filters when component mounts
  useEffect(() => {
    loadSocialFilters();
  }, [loadSocialFilters]);

  // Get sorted filters
  const filters = useMemo(() => {
    return getFilterConfig('social');
  }, [getFilterConfig, socialFilters]);

  // Open dropdown for a filter
  const openDropdown = useCallback((filter: Filter) => {
    setDropdownFilter(filter);
    setShowDropdown(true);
  }, []);

  // Select option in dropdown
  const selectOption = useCallback((value: string) => {
    if (!dropdownFilter) return;

    if (dropdownFilter.filter_type === 'multi_select') {
      // Toggle value in array
      const currentValues = (filterValues[dropdownFilter.key] as string[]) || [];
      if (currentValues.includes(value)) {
        setFilterValues(prev => ({
          ...prev,
          [dropdownFilter.key]: currentValues.filter(v => v !== value)
        }));
      } else {
        setFilterValues(prev => ({
          ...prev,
          [dropdownFilter.key]: [...currentValues, value]
        }));
      }
    } else {
      // Single select - close dropdown after selection
      setFilterValues(prev => ({
        ...prev,
        [dropdownFilter.key]: value
      }));
      setShowDropdown(false);
    }
  }, [dropdownFilter, filterValues]);

  // Clear a filter value
  const clearFilter = useCallback((key: string) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: null
    }));
  }, []);

  // Get display value for a filter
  const getDisplayValue = useCallback((filter: Filter): string | null => {
    const value = filterValues[filter.key];
    if (!value) return null;

    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      // Find labels for selected values
      const options = getFilterOptions('social', filter.key);
      const labels = value.map(v => {
        const opt = options.find(o => o.value === v);
        return opt?.label || v;
      });
      return labels.join(', ');
    }

    // Single value - find label
    const options = getFilterOptions('social', filter.key);
    const opt = options.find(o => o.value === value);
    return opt?.label || value;
  }, [filterValues, getFilterOptions]);

  // Check if filter has value
  const hasFilterValue = useCallback((filter: Filter): boolean => {
    const value = filterValues[filter.key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  }, [filterValues]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(filterValues).filter(v => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && v !== '';
    }).length;
  }, [filterValues]);

  // Load messages
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};

      // Build params from filter values
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value) && value.length > 0) {
            params[key] = value.join(',');
          } else if (typeof value === 'string') {
            params[key] = value;
          }
        }
      });

      const response = await api.get('/whatsapp/social/search', { params });
      if (response.data) {
        setMessages(response.data.results || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.log('Social search not available:', error);
      setMessages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterValues]);

  // Handle confirm filters
  const handleConfirmFilters = useCallback(() => {
    setScreenState('results');
    loadMessages();
  }, [loadMessages]);

  // Handle back from results
  const handleBackFromResults = useCallback(() => {
    setScreenState('filters');
  }, []);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, [loadMessages]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return null;
    const symbol = currency === 'EUR' ? '\u20AC' : currency === 'USD' ? '$' : currency;
    return `${symbol}${price.toLocaleString()}`;
  };

  const getOfferTypeBadgeStyle = (type: string) => {
    if (type === 'wts') {
      return { bg: 'rgba(74, 160, 120, 0.1)', color: '#4AA078', label: 'WTS' };
    } else if (type === 'wtb') {
      return { bg: 'rgba(66, 133, 244, 0.1)', color: '#4285F4', label: 'WTB' };
    }
    return { bg: 'rgba(33, 33, 33, 0.05)', color: 'rgba(33, 33, 33, 0.6)', label: 'Unknown' };
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(8),
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    backButton: {
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      textAlign: 'center',
      marginRight: sp(44),
    },
    // Filter screen styles
    filterContainer: {
      flex: 1,
    },
    filterScrollContent: {
      paddingHorizontal: wp(16),
      paddingTop: hp(20),
      paddingBottom: hp(120),
    },
    filterTitle: {
      fontSize: fp(24),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(8),
    },
    filterSubtitle: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      marginBottom: hp(24),
    },
    fieldContainer: {
      marginBottom: hp(20),
    },
    fieldLabel: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(6),
      letterSpacing: 0.075,
    },
    fieldInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: 'rgba(29, 29, 31, 0.1)',
      borderRadius: sp(16),
      paddingHorizontal: wp(16),
      paddingVertical: hp(14),
    },
    fieldInputContainerActive: {
      borderColor: '#212121',
    },
    fieldPlaceholder: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      opacity: 0.5,
      flex: 1,
    },
    fieldValue: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      flex: 1,
    },
    fieldInput: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      padding: 0,
    },
    // Bottom buttons
    bottomButtonsContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: wp(25),
      paddingTop: hp(24),
      paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(24),
      borderTopWidth: 1,
      borderTopColor: 'rgba(33, 33, 33, 0.05)',
    },
    confirmButton: {
      backgroundColor: '#212121',
      borderRadius: sp(99),
      paddingVertical: hp(14),
      alignItems: 'center',
    },
    confirmButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
      letterSpacing: 0.08,
    },
    // Results screen styles
    resultsCount: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultsCountText: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
    },
    editFiltersButton: {
      paddingHorizontal: wp(12),
      paddingVertical: hp(6),
      borderRadius: sp(99),
      backgroundColor: '#F6F7F9',
    },
    editFiltersText: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: wp(16),
      paddingBottom: hp(32),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
    },
    emptyIconContainer: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(32),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    emptyTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      marginBottom: hp(8),
    },
    emptySubtitle: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      paddingHorizontal: wp(24),
    },
    messageCard: {
      backgroundColor: '#FAFAFA',
      borderRadius: sp(16),
      padding: wp(16),
      marginBottom: hp(12),
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: hp(12),
    },
    messageBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    offerBadge: {
      paddingHorizontal: wp(10),
      paddingVertical: hp(4),
      borderRadius: sp(99),
    },
    offerBadgeText: {
      fontSize: fp(11),
      fontFamily: fonts.bold,
    },
    messageBrand: {
      fontSize: fp(14),
      fontFamily: fonts.semiBold,
      color: '#212121',
    },
    messageReference: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
    },
    messageDate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    messageDateText: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
    },
    messageContent: {
      marginBottom: hp(12),
    },
    messageText: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
    },
    messageFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: hp(12),
      borderTopWidth: 1,
      borderTopColor: 'rgba(33, 33, 33, 0.05)',
    },
    sellerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    sellerAvatar: {
      width: sp(32),
      height: sp(32),
      borderRadius: sp(16),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sellerName: {
      fontSize: fp(14),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    sellerPhone: {
      fontSize: fp(12),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
    },
    locationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    locationText: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
    },
    priceText: {
      fontSize: fp(17),
      fontFamily: fonts.bold,
      color: '#212121',
    },
    // Dropdown Modal
    dropdownOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    dropdownContent: {
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: sp(24),
      borderTopRightRadius: sp(24),
      maxHeight: '70%',
    },
    dropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp(16),
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
      position: 'relative',
    },
    dropdownTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
    },
    dropdownCloseButton: {
      position: 'absolute',
      right: wp(16),
      width: sp(32),
      height: sp(32),
      borderRadius: sp(16),
      backgroundColor: '#F5F5F5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownScrollContent: {
      paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(16),
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: hp(16),
      paddingHorizontal: wp(16),
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    dropdownOptionText: {
      fontSize: fp(16),
      fontFamily: fonts.regular,
      color: '#212121',
    },
    dropdownOptionSelected: {
      fontFamily: fonts.semiBold,
    },
    dropdownDoneButton: {
      marginHorizontal: wp(16),
      marginTop: hp(16),
      backgroundColor: '#212121',
      borderRadius: sp(99),
      paddingVertical: hp(14),
      alignItems: 'center',
    },
    dropdownDoneButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
  });

  // Render filter field based on type
  const renderFilterField = (filter: Filter) => {
    const value = filterValues[filter.key];
    const displayValue = getDisplayValue(filter);
    const hasValue = hasFilterValue(filter);

    if (filter.filter_type === 'text') {
      return (
        <View key={filter.key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{filter.name}</Text>
          <View style={[styles.fieldInputContainer, hasValue && styles.fieldInputContainerActive]}>
            <Search size={18} color="rgba(33, 33, 33, 0.4)" />
            <TextInput
              style={[styles.fieldInput, { marginLeft: wp(8) }]}
              placeholder={filter.placeholder || `Enter ${filter.name.toLowerCase()}`}
              placeholderTextColor="rgba(33, 33, 33, 0.4)"
              value={(value as string) || ''}
              onChangeText={(text) => setFilterValues(prev => ({ ...prev, [filter.key]: text || null }))}
            />
          </View>
        </View>
      );
    }

    // Dropdown for single_select or multi_select
    return (
      <View key={filter.key} style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{filter.name}</Text>
        <TouchableOpacity
          style={[styles.fieldInputContainer, hasValue && styles.fieldInputContainerActive]}
          onPress={() => openDropdown(filter)}
        >
          {displayValue ? (
            <Text style={styles.fieldValue} numberOfLines={1}>{displayValue}</Text>
          ) : (
            <Text style={styles.fieldPlaceholder}>{filter.placeholder || `Select ${filter.name.toLowerCase()}`}</Text>
          )}
          <ChevronDown size={sp(18)} color="#1D1D1F" />
        </TouchableOpacity>
      </View>
    );
  };

  // Show loading state
  if (isLoadingSocialFilters && filters.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <BackArrow size={24} color="#212121" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Social Search</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#212121" />
            <Text style={{ marginTop: hp(16), fontFamily: fonts.medium, color: '#212121' }}>
              Loading filters...
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // Filter screen
  if (screenState === 'filters') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <BackArrow size={24} color="#212121" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Social Search</Text>
          </View>

          <ScrollView
            style={styles.filterContainer}
            contentContainerStyle={styles.filterScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.filterTitle}>Search Filters</Text>
            <Text style={styles.filterSubtitle}>
              Configure your search criteria to find relevant social messages
            </Text>

            {filters.map(filter => renderFilterField(filter))}
          </ScrollView>

          <View style={styles.bottomButtonsContainer}>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmFilters}>
              <Text style={styles.confirmButtonText}>
                {activeFilterCount > 0 ? `Search (${activeFilterCount} filters)` : 'Search All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dropdown Modal */}
          <Modal
            visible={showDropdown}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowDropdown(false)}
          >
            <View style={styles.dropdownOverlay}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setShowDropdown(false)}
              />
              <View style={styles.dropdownContent}>
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>{dropdownFilter?.name || 'Select'}</Text>
                  <TouchableOpacity
                    style={styles.dropdownCloseButton}
                    onPress={() => setShowDropdown(false)}
                  >
                    <X size={sp(18)} color="#212121" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.dropdownScrollContent}>
                  {dropdownFilter && getFilterOptions('social', dropdownFilter.key).map((option) => {
                    const isSelected = dropdownFilter.filter_type === 'multi_select'
                      ? ((filterValues[dropdownFilter.key] as string[]) || []).includes(option.value)
                      : filterValues[dropdownFilter.key] === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={styles.dropdownOption}
                        onPress={() => selectOption(option.value)}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            isSelected && styles.dropdownOptionSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && <Check size={sp(20)} color="#212121" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {dropdownFilter?.filter_type === 'multi_select' && (
                  <TouchableOpacity
                    style={styles.dropdownDoneButton}
                    onPress={() => setShowDropdown(false)}
                  >
                    <Text style={styles.dropdownDoneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </>
    );
  }

  // Results screen
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackFromResults}>
            <BackArrow size={24} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Results</Text>
        </View>

        {/* Results Count & Edit Filters */}
        <View style={styles.resultsCount}>
          <Text style={styles.resultsCountText}>
            {loading ? 'Searching...' : `${total} messages found`}
          </Text>
          <TouchableOpacity style={styles.editFiltersButton} onPress={handleBackFromResults}>
            <Text style={styles.editFiltersText}>
              Edit Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#212121" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Search size={28} color="rgba(33, 33, 33, 0.4)" />
              </View>
              <Text style={styles.emptyTitle}>No messages found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your filters to see more results.
              </Text>
            </View>
          ) : (
            messages.map((message) => {
              const badgeStyle = getOfferTypeBadgeStyle(message.offer_type);
              return (
                <View key={message.id} style={styles.messageCard}>
                  {/* Header */}
                  <View style={styles.messageHeader}>
                    <View style={styles.messageBadgeRow}>
                      <View style={[styles.offerBadge, { backgroundColor: badgeStyle.bg }]}>
                        <Text style={[styles.offerBadgeText, { color: badgeStyle.color }]}>
                          {badgeStyle.label}
                        </Text>
                      </View>
                      {message.brand && (
                        <Text style={styles.messageBrand}>{message.brand}</Text>
                      )}
                      {message.reference && (
                        <Text style={styles.messageReference}>{message.reference}</Text>
                      )}
                    </View>
                    <View style={styles.messageDate}>
                      <Calendar size={14} color="rgba(33, 33, 33, 0.5)" />
                      <Text style={styles.messageDateText}>
                        {formatDate(message.message_timestamp)}
                      </Text>
                    </View>
                  </View>

                  {/* Content */}
                  <View style={styles.messageContent}>
                    <Text style={styles.messageText} numberOfLines={3}>
                      {message.raw_text}
                    </Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.messageFooter}>
                    <View style={styles.sellerInfo}>
                      <View style={styles.sellerAvatar}>
                        <User size={16} color="rgba(33, 33, 33, 0.4)" />
                      </View>
                      <View>
                        <Text style={styles.sellerName}>{message.seller_name}</Text>
                        {message.seller_phone && (
                          <Text style={styles.sellerPhone}>{message.seller_phone}</Text>
                        )}
                      </View>
                      {message.country_name && (
                        <View style={styles.locationInfo}>
                          <MapPin size={14} color="rgba(33, 33, 33, 0.5)" />
                          <Text style={styles.locationText}>{message.country_name}</Text>
                        </View>
                      )}
                    </View>
                    {message.price && (
                      <Text style={styles.priceText}>
                        {formatPrice(message.price, message.currency)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
