/**
 * Search (spec 0.3): "Search reference, model or brand". Uses GET /market/search?q=, which
 * resolves aliases and dealer slang ("Pepsi Jubilee", "Pikachu") to WS codes. Results are shown as
 * Market cards; an empty query shows the recent searches.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BackArrow, Magnifier, X } from '@/components/icons';
import { SEARCH_PLACEHOLDER } from '@/components/market/AppHeader';
import { MarketCard, MarketCardSkeleton, openCard } from '@/components/market/MarketCard';
import { UI } from '@/components/market/tokens';
import { MarketCardData, toCards } from '@/components/market/types';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { fp, hp, sp, wp, SCREEN_WIDTH } from '@/utils/responsive';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;
const H_PADDING = wp(16);
const GAP = wp(12);
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GAP) / 2;

export default function SearchScreen() {
  const { fonts } = useTheme();
  const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>();
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<MarketCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (raw) setRecent(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/market/search', { params: { q } });
        if (id === requestId.current) setResults(toCards(res.data));
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const saveRecent = (value: string) => {
    const q = value.trim();
    if (!q) return;
    const next = [q, ...recent.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(
      0,
      MAX_RECENT_SEARCHES
    );
    setRecent(next);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
  };

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
  };

  const onCardPress = (card: MarketCardData) => {
    saveRecent(query);
    Keyboard.dismiss();
    openCard(card);
  };

  const showRecent = !query.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <BackArrow size={24} color={UI.text} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <Magnifier size={sp(17)} color={UI.grey} />
          <TextInput
            style={[styles.input, { fontFamily: fonts.regular }]}
            value={query}
            onChangeText={setQuery}
            placeholder={SEARCH_PLACEHOLDER}
            placeholderTextColor={UI.grey}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => saveRecent(query)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear">
              <X size={sp(16)} color={UI.grey} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {showRecent ? (
        <View style={styles.recent}>
          {recent.length > 0 ? (
            <>
              <View style={styles.recentHeader}>
                <Text style={[styles.sectionTitle, { fontFamily: fonts.semiBold }]}>
                  Recent searches
                </Text>
                <TouchableOpacity onPress={clearRecent}>
                  <Text style={[styles.link, { fontFamily: fonts.medium }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              {recent.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.recentRow}
                  onPress={() => setQuery(item)}
                >
                  <Text style={[styles.recentText, { fontFamily: fonts.regular }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}
        </View>
      ) : loading && results.length === 0 ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MarketCardSkeleton key={i} width={CARD_WIDTH} />
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <MarketCard card={item} width={CARD_WIDTH} onPress={onCardPress} />
          )}
          ListEmptyComponent={
            searched ? (
              <Text style={[styles.empty, { fontFamily: fonts.regular }]}>
                No watches found for “{query.trim()}”
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    gap: wp(8),
  },
  back: { padding: sp(4) },
  inputWrap: {
    flex: 1,
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: UI.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    gap: wp(8),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapFocused: { borderColor: UI.blue, backgroundColor: UI.white },
  input: { flex: 1, fontSize: fp(15), color: UI.text, padding: 0 },
  recent: { paddingHorizontal: H_PADDING, paddingTop: hp(12) },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(6),
  },
  sectionTitle: { fontSize: fp(17), color: UI.text },
  link: { fontSize: fp(14), color: UI.blue },
  recentRow: {
    paddingVertical: hp(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.line,
  },
  recentText: { fontSize: fp(15), color: UI.text },
  list: { paddingHorizontal: H_PADDING, paddingTop: hp(8), paddingBottom: hp(40), gap: GAP },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PADDING,
    paddingTop: hp(8),
  },
  empty: { textAlign: 'center', color: UI.grey, fontSize: fp(14), marginTop: hp(40) },
});
