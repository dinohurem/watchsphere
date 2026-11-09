/**
 * Activity – notification centre (redesign spec v3, section 7 – N1).
 *
 * Replaces the Chat tab. Alert matches (new WTS / WTB) grouped by day, unread dot + bold
 * reference, round chat button with the age, "Mark all read". Tapping an entry marks it read and
 * opens the detail page with the listing(s) highlighted (N2).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ActivityRow, ActivityRowSkeleton } from '@/components/activity/ActivityRow';
import { ActivityEntry, groupByDay, toActivityEntries } from '@/components/activity/types';
import { AppHeader, ScreenTitle } from '@/components/market/AppHeader';
import { StaggerIn, useFirstAppearance } from '@/components/market/StaggerIn';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useRefreshActivityBadge } from '@/hooks/useActivityUnread';
import { onAlertMatchReceived } from '@/hooks/useAlertPushHandling';
import { useCachedResource } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { openWatchDetail } from '@/utils/navigation';
import { fp, hp, wp } from '@/utils/responsive';

const PAGE_SIZE = 50;

export default function ActivityScreen() {
  const { fonts } = useTheme();
  const refreshBadge = useRefreshActivityBadge();
  const [extra, setExtra] = useState<ActivityEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const feed = useCachedResource<ActivityEntry[]>('activity:alert_match', async () => {
    const res = await api.get('/notifications', {
      params: { type: 'alert_match', limit: PAGE_SIZE, offset: 0 },
    });
    const list = toActivityEntries(res.data);
    setExtra([]);
    setHasMore(list.length >= PAGE_SIZE);
    return list;
  });

  const entries = [...(feed.data ?? []), ...extra];
  const animateFirst = useFirstAppearance('activity', !!feed.data);

  // Entries that arrive while the list is open slide in at the top (M3).
  const knownIds = useRef<Set<string> | null>(null);
  const newIds = useRef<Set<string>>(new Set());
  if (feed.data) {
    if (!knownIds.current) {
      knownIds.current = new Set(feed.data.map((e) => e.id));
    } else {
      for (const e of feed.data) {
        if (!knownIds.current.has(e.id)) {
          knownIds.current.add(e.id);
          newIds.current.add(e.id);
        }
      }
    }
  }

  useEffect(() => onAlertMatchReceived(() => feed.reload()), [feed.reload]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      feed.reload();
      refreshBadge();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const updateRead = (predicate: (e: ActivityEntry) => boolean) => {
    feed.setData((prev) => prev?.map((e) => (predicate(e) ? { ...e, read: true } : e)));
    setExtra((prev) => prev.map((e) => (predicate(e) ? { ...e, read: true } : e)));
  };

  const openEntry = (entry: ActivityEntry) => {
    if (!entry.read) {
      updateRead((e) => e.id === entry.id);
      api
        .post(`/notifications/${entry.id}/read`)
        .catch(() => {})
        .finally(refreshBadge);
    }
    const d = entry.data;
    openWatchDetail({
      id: d.watch_id || d.ws_code || d.reference,
      wsCode: d.ws_code,
      reference: d.reference,
      brand: d.brand,
      model: d.model,
      highlight: d.order_ids,
      side: d.kind,
    });
  };

  const markAllRead = () => {
    updateRead(() => true);
    api
      .post('/notifications/read-all', null, { params: { type: 'alert_match' } })
      .catch(() => {})
      .finally(refreshBadge);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || !feed.data) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/notifications', {
        params: { type: 'alert_match', limit: PAGE_SIZE, offset: entries.length },
      });
      const next = toActivityEntries(res.data);
      setExtra((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasUnread = entries.some((e) => !e.read);
  const sections = groupByDay(entries);
  let rowIndex = 0;

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScreenTitle
        title="Activity"
        right={
          <TouchableOpacity onPress={markAllRead} disabled={!hasUnread} hitSlop={8}>
            <Text
              style={[styles.markAll, { fontFamily: fonts.medium, opacity: hasUnread ? 1 : 0.4 }]}
            >
              Mark all read
            </Text>
          </TouchableOpacity>
        }
      />
      {feed.showSkeleton ? (
        <View>
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityRowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.day, { fontFamily: fonts.medium }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const index = rowIndex++;
            const isNew = newIds.current.has(item.id);
            return (
              <StaggerIn index={isNew ? 0 : index} animate={animateFirst || isNew}>
                <ActivityRow entry={item} onPress={openEntry} />
              </StaggerIn>
            );
          }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={feed.refreshing}
              onRefresh={() => {
                feed.refresh();
                refreshBadge();
              }}
            />
          }
          ListEmptyComponent={
            feed.loading ? null : (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyTitle, { fontFamily: fonts.semiBold }]}>
                  No activity yet
                </Text>
                <Text style={[styles.emptyText, { fontFamily: fonts.regular }]}>
                  New listings that match your alerts show up here.
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  markAll: { fontSize: fp(15), color: UI.blue },
  list: { paddingBottom: hp(120) },
  day: {
    fontSize: fp(13),
    color: UI.grey,
    paddingHorizontal: wp(20),
    paddingTop: hp(14),
    paddingBottom: hp(2),
  },
  emptyBox: { alignItems: 'center', paddingHorizontal: wp(32), marginTop: hp(60) },
  emptyTitle: { fontSize: fp(16), color: UI.text },
  emptyText: { fontSize: fp(14), color: UI.grey, textAlign: 'center', marginTop: hp(6) },
});
