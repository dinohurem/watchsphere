import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig } from '@/contexts/ConfigContext';
import { BackArrow, Search, Filter, MapPin, Calendar, User } from '@/components/icons';
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

interface Country {
  code: string;
  name: string;
}

export default function SocialSearchScreen() {
  const { colors, fonts } = useTheme();
  const { getFilterOptions, getFilterByKey, loadSocialFilters } = useConfig();

  // Lazy load social filters when component mounts
  useEffect(() => {
    loadSocialFilters();
  }, [loadSocialFilters]);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  // Filter state
  const [offerType, setOfferType] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get countries from dynamic config
  const countries = useMemo(() => {
    const options = getFilterOptions('social', 'country_code');
    if (options.length > 0) {
      return options.map(opt => ({ code: opt.value, name: opt.label }));
    }
    // Fallback if config not loaded yet
    return [
      { code: 'US', name: 'United States' },
      { code: 'UK', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'IT', name: 'Italy' },
      { code: 'FR', name: 'France' },
    ];
  }, [getFilterOptions]);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    loadMessages();
  }, [offerType, selectedCountry]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (offerType) params.offer_type = offerType;
      if (reference) params.reference = reference;
      if (selectedCountry) params.country_code = selectedCountry;

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
  };

  const handleSearch = () => {
    loadMessages();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, [offerType, reference, selectedCountry]);

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

  const activeFilterCount = (offerType ? 1 : 0) + (reference ? 1 : 0) + (selectedCountry ? 1 : 0);

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
    filterSection: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    offerTypeButton: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(10),
      borderRadius: sp(99),
      backgroundColor: '#F6F7F9',
    },
    offerTypeButtonActive: {
      backgroundColor: '#212121',
    },
    offerTypeButtonWTS: {
      backgroundColor: '#4AA078',
    },
    offerTypeButtonWTB: {
      backgroundColor: '#4285F4',
    },
    offerTypeText: {
      fontSize: fp(14),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    offerTypeTextActive: {
      color: '#FFFFFF',
    },
    filterButton: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      backgroundColor: '#F6F7F9',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 'auto',
    },
    filterButtonActive: {
      backgroundColor: '#212121',
    },
    filterBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: sp(18),
      height: sp(18),
      borderRadius: sp(9),
      backgroundColor: '#D90429',
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterBadgeText: {
      fontSize: fp(10),
      fontFamily: fonts.bold,
      color: '#FFFFFF',
    },
    expandedFilters: {
      marginTop: hp(16),
      gap: hp(12),
    },
    filterLabel: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: 'rgba(33, 33, 33, 0.6)',
      marginBottom: hp(6),
    },
    searchInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F6F7F9',
      borderRadius: sp(12),
      paddingHorizontal: wp(12),
      height: sp(44),
      gap: wp(8),
    },
    searchInputField: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
    },
    countrySelect: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(8),
    },
    countryChip: {
      paddingHorizontal: wp(12),
      paddingVertical: hp(8),
      borderRadius: sp(99),
      backgroundColor: '#F6F7F9',
    },
    countryChipActive: {
      backgroundColor: '#212121',
    },
    countryChipText: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#212121',
    },
    countryChipTextActive: {
      color: '#FFFFFF',
    },
    applyButton: {
      backgroundColor: '#212121',
      paddingVertical: hp(14),
      borderRadius: sp(12),
      alignItems: 'center',
      marginTop: hp(8),
    },
    applyButtonText: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    resultsCount: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
    },
    resultsCountText: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.5)',
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
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <BackArrow size={24} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Social Search</Text>
        </View>

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.offerTypeButton,
                offerType === null && styles.offerTypeButtonActive,
              ]}
              onPress={() => setOfferType(null)}
            >
              <Text style={[
                styles.offerTypeText,
                offerType === null && styles.offerTypeTextActive,
              ]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.offerTypeButton,
                offerType === 'wts' && styles.offerTypeButtonWTS,
              ]}
              onPress={() => setOfferType('wts')}
            >
              <Text style={[
                styles.offerTypeText,
                offerType === 'wts' && styles.offerTypeTextActive,
              ]}>
                WTS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.offerTypeButton,
                offerType === 'wtb' && styles.offerTypeButtonWTB,
              ]}
              onPress={() => setOfferType('wtb')}
            >
              <Text style={[
                styles.offerTypeText,
                offerType === 'wtb' && styles.offerTypeTextActive,
              ]}>
                WTB
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, showFilters && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} color={showFilters ? '#FFFFFF' : '#212121'} />
              {activeFilterCount > 0 && !showFilters && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Expanded Filters */}
          {showFilters && (
            <View style={styles.expandedFilters}>
              {/* Reference Search */}
              <View>
                <Text style={styles.filterLabel}>Reference Number</Text>
                <View style={styles.searchInput}>
                  <Search size={18} color="rgba(33, 33, 33, 0.4)" />
                  <TextInput
                    style={styles.searchInputField}
                    placeholder="e.g. 126610LN"
                    placeholderTextColor="rgba(33, 33, 33, 0.4)"
                    value={reference}
                    onChangeText={setReference}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                </View>
              </View>

              {/* Country Filter */}
              <View>
                <Text style={styles.filterLabel}>Country</Text>
                <View style={styles.countrySelect}>
                  <TouchableOpacity
                    style={[
                      styles.countryChip,
                      selectedCountry === null && styles.countryChipActive,
                    ]}
                    onPress={() => setSelectedCountry(null)}
                  >
                    <Text style={[
                      styles.countryChipText,
                      selectedCountry === null && styles.countryChipTextActive,
                    ]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {countries.slice(0, 6).map((country) => (
                    <TouchableOpacity
                      key={country.code}
                      style={[
                        styles.countryChip,
                        selectedCountry === country.code && styles.countryChipActive,
                      ]}
                      onPress={() => setSelectedCountry(country.code)}
                    >
                      <Text style={[
                        styles.countryChipText,
                        selectedCountry === country.code && styles.countryChipTextActive,
                      ]}>
                        {country.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Apply Button */}
              <TouchableOpacity style={styles.applyButton} onPress={handleSearch}>
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Results Count */}
        {!loading && messages.length > 0 && (
          <View style={styles.resultsCount}>
            <Text style={styles.resultsCountText}>
              Showing {messages.length} of {total} messages
            </Text>
          </View>
        )}

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
              <Text style={styles.emptyTitle}>
                {activeFilterCount > 0 ? 'No messages match your filters' : 'No messages found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilterCount > 0
                  ? 'Try adjusting your filters to see more results.'
                  : 'Social messages from imported WhatsApp groups will appear here.'}
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
