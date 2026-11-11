/**
 * Home (redesign spec v3, section 5 – H1 / H2).
 *
 * Header: WS logo, search bar, profile button. Watchlist as 2-column Market cards (1M chip,
 * "See all"), empty state H2, and Recently viewed (last 5, hidden when empty).
 * Trending news is removed.
 */
import React, { useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { WatchlistEmpty } from '@/components/home/WatchlistEmpty';
import { AppHeader } from '@/components/market/AppHeader';
import { MarketCard, MarketCardSkeleton } from '@/components/market/MarketCard';
import { SkeletonCrossFade } from '@/components/market/Shimmer';
import { StaggerIn, useFirstAppearance } from '@/components/market/StaggerIn';
import { UI } from '@/components/market/tokens';
import { MarketCardData, toCards, watchlistToCards } from '@/components/market/types';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { fp, hp, wp, SCREEN_WIDTH } from '@/utils/responsive';

const H_PADDING = wp(16);
const GAP = wp(12);
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GAP) / 2;
const WATCHLIST_PREVIEW = 4;

export default function HomeScreen() {
  const { fonts } = useTheme();

  const watchlist = useCachedResource<MarketCardData[]>('home:watchlist', async () => {
    const res = await api.get('/profile/watchlist');
    return watchlistToCards(res.data);
  });
  const recent = useCachedResource<MarketCardData[]>('home:recently-viewed', async () => {
    const res = await api.get('/profile/recently-viewed');
    return toCards(res.data).slice(0, 5);
  });

  const animateWatchlist = useFirstAppearance('home:watchlist', !!watchlist.data);
  const animateRecent = useFirstAppearance('home:recent', !!recent.data);

  // Refresh silently whenever Home comes back into focus (e.g. after opening a watch).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      watchlist.reload();
      recent.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = () => {
    watchlist.refresh();
    recent.refresh();
  };

  const watchItems = watchlist.data ?? [];
  const recentItems = recent.data ?? [];

  const header = <AppHeader search profile />;

  return (
    <SubscriptionOverlay feature="home" header={header}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={watchlist.refreshing || recent.refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>Watchlist</Text>
          {watchItems.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/profile/favorites' as never)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.seeAll, { fontFamily: fonts.medium }]}>See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <SkeletonCrossFade
          loading={watchlist.showSkeleton}
          skeleton={
            <View style={styles.grid}>
              {Array.from({ length: WATCHLIST_PREVIEW }).map((_, i) => (
                <MarketCardSkeleton key={i} width={CARD_WIDTH} />
              ))}
            </View>
          }
        >
        {watchItems.length > 0 ? (
          <View style={styles.grid}>
            {watchItems.slice(0, WATCHLIST_PREVIEW).map((card, index) => (
              <StaggerIn key={`${card.id}-${index}`} index={index} animate={animateWatchlist}>
                <MarketCard card={card} width={CARD_WIDTH} />
              </StaggerIn>
            ))}
          </View>
        ) : (
          <WatchlistEmpty />
        )}
        </SkeletonCrossFade>

        {recentItems.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: hp(28) }]}>
              <Text style={[styles.sectionTitle, { fontFamily: fonts.bold }]}>Recently viewed</Text>
            </View>
            <RecentlyViewed items={recentItems} animate={animateRecent} />
          </>
        ) : null}
      </ScrollView>
    </SubscriptionOverlay>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: H_PADDING, paddingTop: hp(8), paddingBottom: hp(120) },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(12),
  },
  sectionTitle: { fontSize: fp(22), color: UI.text },
  seeAll: { fontSize: fp(14), color: UI.blue },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
