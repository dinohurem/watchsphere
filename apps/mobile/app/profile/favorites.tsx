/** Watchlist – "See all" from Home: every watchlist entry as a Market card (spec H1). */
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { WatchlistEmpty } from '@/components/home/WatchlistEmpty';
import { ChevronLeft } from '@/components/icons';
import { MarketCard, MarketCardSkeleton } from '@/components/market/MarketCard';
import { UI } from '@/components/market/tokens';
import { MarketCardData, watchlistToCards } from '@/components/market/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { fp, hp, sp, wp, SCREEN_WIDTH } from '@/utils/responsive';

const H_PADDING = wp(16);
const GAP = wp(12);
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GAP) / 2;

export default function WatchlistScreen() {
  const { fonts } = useTheme();
  const watchlist = useCachedResource<MarketCardData[]>('home:watchlist', async () => {
    const res = await api.get('/profile/watchlist');
    return watchlistToCards(res.data);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={sp(24)} color={UI.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: fonts.semiBold }]}>Watchlist</Text>
        <View style={styles.back} />
      </View>
      {watchlist.showSkeleton ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketCardSkeleton key={i} width={CARD_WIDTH} />
          ))}
        </View>
      ) : (
        <FlatList
          data={watchlist.data ?? []}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MarketCard card={item} width={CARD_WIDTH} />}
          refreshControl={
            <RefreshControl refreshing={watchlist.refreshing} onRefresh={watchlist.refresh} />
          }
          ListEmptyComponent={watchlist.loading ? null : <WatchlistEmpty />}
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
    justifyContent: 'space-between',
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
  },
  back: { width: sp(32), height: sp(32), justifyContent: 'center' },
  title: { fontSize: fp(17), color: UI.text },
  list: { paddingHorizontal: H_PADDING, paddingTop: hp(8), paddingBottom: hp(40), gap: GAP },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PADDING,
    paddingTop: hp(8),
  },
});
