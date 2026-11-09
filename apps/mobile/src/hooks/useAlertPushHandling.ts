/**
 * Client side of alert-match push notifications (redesign spec v3, section 11).
 *
 * - Registers the iOS notification categories with one action underneath:
 *   `alert_match` → "View listing" (single match), `alert_match_multi` → "View listings" (bundled).
 * - Tapping the notification body or the action opens the watch detail page with the listing(s)
 *   highlighted (payload `order_ids` = "id1,id2", spec N2 / M4).
 * - Incoming alert pushes refresh the Activity badge and notify an open Activity list.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { openWatchDetail } from '@/utils/navigation';

import { useRefreshActivityBadge } from './useActivityUnread';

export const ALERT_MATCH_CATEGORY = 'alert_match';
export const ALERT_MATCH_MULTI_CATEGORY = 'alert_match_multi';
export const VIEW_LISTING_ACTION = 'view_listing';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to "a new alert match arrived" (used by the Activity list to insert new entries). */
export function onAlertMatchReceived(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAlertMatch() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore listener errors
    }
  });
}

let categoriesRegistered = false;
async function registerCategories() {
  if (categoriesRegistered || Platform.OS !== 'ios') return;
  categoriesRegistered = true;
  try {
    await Notifications.setNotificationCategoryAsync(ALERT_MATCH_CATEGORY, [
      {
        identifier: VIEW_LISTING_ACTION,
        buttonTitle: 'View listing',
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(ALERT_MATCH_MULTI_CATEGORY, [
      {
        identifier: VIEW_LISTING_ACTION,
        buttonTitle: 'View listings',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch {
    categoriesRegistered = false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAlertMatch(data: any): boolean {
  return data && data.type === 'alert_match';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function openFromAlertPayload(data: any) {
  const orderIds = Array.isArray(data?.order_ids)
    ? data.order_ids.map(String)
    : String(data?.order_ids ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
  openWatchDetail({
    id: data?.watch_id || data?.ws_code,
    wsCode: data?.ws_code,
    reference: data?.reference,
    highlight: orderIds,
    side: data?.kind === 'wtb' ? 'wtb' : data?.kind === 'wts' ? 'wts' : undefined,
  });
}

/**
 * Mount once in the root layout. `ready` = signed in, approved and the initial navigation done;
 * a tap that launched the app is handled as soon as `ready` turns true.
 */
export function useAlertPushHandling(ready: boolean) {
  const refreshBadge = useRefreshActivityBadge();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    registerCategories();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      if (isAlertMatch(notification.request.content.data)) {
        refreshBadge();
        emitAlertMatch();
      }
    });
    return () => sub.remove();
  }, [refreshBadge]);

  useEffect(() => {
    if (!ready || !lastResponse) return;
    const data = lastResponse.notification.request.content.data;
    if (!isAlertMatch(data)) return;
    const key = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}:${lastResponse.actionIdentifier}`;
    if (handled.current === key) return;
    const isTapOrAction =
      lastResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
      lastResponse.actionIdentifier === VIEW_LISTING_ACTION;
    if (!isTapOrAction) return;
    // Let the initial tab navigation settle before pushing the detail page.
    const timer = setTimeout(() => {
      handled.current = key;
      refreshBadge();
      emitAlertMatch();
      openFromAlertPayload(data);
    }, 350);
    return () => clearTimeout(timer);
  }, [ready, lastResponse, refreshBadge]);
}
