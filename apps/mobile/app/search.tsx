import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, Magnifier } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';

// Close/X icon for clearing search
function CloseIcon({ size = 16, color = '#212121' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M4 4L12 12M12 4L4 12"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Popular searches (can be fetched from API later)
const POPULAR_SEARCHES = [
  'Rolex Daytona',
  'Rolex Submariner',
  'Rolex Datejust',
  'Rolex GMT-Master II',
  'Omega Seamaster',
  'Omega Speedmaster',
  'Audemars Piguet Royal Oak',
  'Patek Philippe Nautilus',
  'Tudor Black Bay',
  'Breitling Navitimer',
];

export default function SearchScreen() {
  const { colors, fonts } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      // Add to beginning, remove duplicates, limit to MAX
      const updated = [
        trimmedQuery,
        ...recentSearches.filter(s => s.toLowerCase() !== trimmedQuery.toLowerCase())
      ].slice(0, MAX_RECENT_SEARCHES);

      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const handleSearch = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    saveRecentSearch(trimmedQuery);
    Keyboard.dismiss();

    // Navigate to market with search query
    router.push({
      pathname: '/(tabs)/market',
      params: { search: trimmedQuery }
    });
  }, [recentSearches]);

  const handleSearchSubmit = () => {
    handleSearch(searchQuery);
  };

  const handleSearchItemPress = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(8),
      paddingVertical: hp(10),
      gap: wp(8),
    },
    backButton: {
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchInputContainer: {
      flex: 1,
      height: sp(43),
      backgroundColor: '#F4F4F4',
      borderRadius: sp(99),
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(24),
      overflow: 'hidden',
    },
    searchInputContainerFocused: {
      borderWidth: 1,
      borderColor: '#212121',
    },
    searchCursor: {
      width: 1,
      height: fp(20),
      backgroundColor: '#212121',
      marginRight: wp(2),
    },
    searchInput: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
      padding: 0,
    },
    clearButton: {
      padding: sp(4),
      marginLeft: wp(8),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: wp(24),
      paddingTop: hp(24),
      paddingBottom: hp(40),
    },
    section: {
      marginBottom: hp(24),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp(24),
    },
    sectionTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
      lineHeight: fp(20),
    },
    clearAllButton: {
      paddingVertical: hp(4),
      paddingHorizontal: wp(8),
    },
    clearAllText: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    searchList: {
      gap: hp(16),
    },
    searchItem: {
      paddingVertical: hp(2),
    },
    searchItemText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.8)',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    emptyText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: colors.textTertiary,
      lineHeight: fp(20),
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Search */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <BackArrow size={24} color="#1D1D1F" />
        </TouchableOpacity>

        <View style={[
          styles.searchInputContainer,
          isFocused && styles.searchInputContainerFocused
        ]}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Watch Sphere"
            placeholderTextColor="rgba(33, 33, 33, 0.5)"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <CloseIcon size={16} color="rgba(33, 33, 33, 0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent searches</Text>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={clearRecentSearches}
              >
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchList}>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={`recent-${index}`}
                  style={styles.searchItem}
                  onPress={() => handleSearchItemPress(search)}
                >
                  <Text style={styles.searchItemText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Popular Searches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular searches</Text>
          </View>
          <View style={styles.searchList}>
            {POPULAR_SEARCHES.map((search, index) => (
              <TouchableOpacity
                key={`popular-${index}`}
                style={styles.searchItem}
                onPress={() => handleSearchItemPress(search)}
              >
                <Text style={styles.searchItemText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
