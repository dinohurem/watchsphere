/**
 * P5 – My alerts (spec v3, 9). All alerts of the user across all watches, grouped by watch
 * (grey header "PATEK PHILIPPE 5811/1G"), rows in the AL8 style with a WTS / WTB chip.
 * Tap → Edit alert (AL9); swipe left → delete (AL10, M6). Linked from Profile via
 * router.push('/alerts').
 */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PICKER_COLORS as P } from '@/components/PickerSheet';
import { AlertsSheet } from '@/components/alerts/AlertsSheet';
import { AlertRow, CollapseOut } from '@/components/alerts/AlertRows';
import { countryNameFor } from '@/components/alerts/AlertPickers';
import {
  WatchAlert,
  alertSubtitle,
  alertTitle,
  deleteAlert,
  fetchAllAlerts,
} from '@/components/alerts/alertModel';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke="#1C1C1E" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MyAlertsScreen() {
  const { fonts } = useTheme();
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<WatchAlert | null>(null);
  const [removing, setRemoving] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setAlerts(await fetchAllAlerts());
    } catch {
      // keep what we have
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const groups = useMemo(() => {
    const map = new Map<string, { header: string; items: WatchAlert[] }>();
    alerts.forEach((alert) => {
      const key = alert.ws_code;
      if (!map.has(key)) {
        const name = [alert.brand, alert.reference || alert.ws_code].filter(Boolean).join(' ');
        map.set(key, { header: name.toUpperCase(), items: [] });
      }
      map.get(key)!.items.push(alert);
    });
    return Array.from(map.entries()).map(([wsCode, group]) => ({ wsCode, ...group }));
  }, [alerts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.bold }]}>My alerts</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {!loaded ? (
          [0, 1].map((i) => (
            <View key={i} style={{ marginBottom: hp(18) }}>
              <View style={[styles.skeleton, { width: wp(160), height: hp(12), marginBottom: hp(8) }]} />
              <View style={[styles.skeleton, { height: hp(120), borderRadius: sp(16) }]} />
            </View>
          ))
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { fontFamily: fonts.bold }]}>No alerts yet</Text>
            <Text style={[styles.emptyBody, { fontFamily: fonts.regular }]}>
              Tap the bell on a watch to get notified about new WTS or WTB listings.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.wsCode} style={{ marginBottom: hp(18) }}>
              <Text style={[styles.groupHeader, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                {group.header}
              </Text>
              <View style={styles.box}>
                {group.items.map((alert, index) => (
                  <CollapseOut
                    key={alert.id}
                    removing={removing.includes(alert.id)}
                    onRemoved={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                  >
                    <AlertRow
                      chip={alert.alert_type}
                      title={alertTitle(alert)}
                      subtitle={alertSubtitle(alert, countryNameFor)}
                      isFirst={index === 0}
                      onPress={() => setEditing(alert)}
                      onDelete={async () => {
                        await deleteAlert(alert.id);
                        setRemoving((prev) => [...prev, alert.id]);
                      }}
                    />
                  </CollapseOut>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {editing ? (
        <AlertsSheet
          visible={editing !== null}
          onClose={() => setEditing(null)}
          wsCode={editing.ws_code}
          alerts={alerts.filter((a) => a.ws_code === editing.ws_code)}
          start={{ mode: 'edit', alert: editing }}
          onChanged={load}
          standalone
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
  },
  back: { width: sp(36), height: sp(36), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fp(17), color: P.text },
  content: { paddingHorizontal: wp(16), paddingTop: hp(8), paddingBottom: hp(40) },
  groupHeader: { fontSize: fp(12), color: P.grey, marginBottom: hp(6), marginLeft: wp(4), letterSpacing: 0.3 },
  box: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECEF',
    borderRadius: sp(16),
    overflow: 'hidden',
  },
  skeleton: { backgroundColor: '#ECECEF', borderRadius: sp(6) },
  empty: { alignItems: 'center', paddingTop: hp(80), paddingHorizontal: wp(24) },
  emptyTitle: { fontSize: fp(17), color: P.text },
  emptyBody: { fontSize: fp(14), color: P.grey, textAlign: 'center', marginTop: hp(6), lineHeight: fp(20) },
});
