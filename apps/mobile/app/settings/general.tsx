/**
 * P4 – Notifications (was "General"): Push notifications, Email notifications, WTS & WTB alerts.
 * "Price alerts" and "App language" are removed.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { UI } from '@/components/market/tokens';
import { FormBox, SettingsHeader, ToggleRow } from '@/components/settings/FormRows';
import { api } from '@/services/api';
import { hp, wp } from '@/utils/responsive';

type PrefKey = 'notifications_enabled' | 'email_notifications_enabled' | 'notify_alert_matches';

type Prefs = Record<PrefKey, boolean>;

const DEFAULTS: Prefs = {
  notifications_enabled: true,
  email_notifications_enabled: true,
  notify_alert_matches: true,
};

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/profile/me');
      const d = res.data ?? {};
      setPrefs({
        notifications_enabled: d.notifications_enabled ?? true,
        email_notifications_enabled: d.email_notifications_enabled ?? true,
        notify_alert_matches: d.notify_alert_matches ?? true,
      });
    } catch {
      // keep defaults
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const update = async (key: PrefKey, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    try {
      await api.patch('/profile/notification-preferences', { [key]: value });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !value }));
    }
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        <FormBox>
          <ToggleRow
            first
            title="Push notifications"
            subtitle="Receive notifications on your device"
            value={prefs.notifications_enabled}
            onChange={(v) => update('notifications_enabled', v)}
            disabled={!loaded}
          />
          <ToggleRow
            title="Email notifications"
            subtitle="Receive updates via email"
            value={prefs.email_notifications_enabled}
            onChange={(v) => update('email_notifications_enabled', v)}
            disabled={!loaded}
          />
          <ToggleRow
            title="WTS & WTB alerts"
            subtitle="Get notified when one of your alerts matches"
            value={prefs.notify_alert_matches}
            onChange={(v) => update('notify_alert_matches', v)}
            disabled={!loaded}
          />
        </FormBox>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingTop: hp(12) },
});
