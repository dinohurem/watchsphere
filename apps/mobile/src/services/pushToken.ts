import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';

export const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

/**
 * Register this device's push token for the signed-in account. Never prompts: only when the
 * permission is already granted. The backend moves the token away from any other account, so a
 * phone only ever gets the pushes of the account that is signed in on it.
 */
export async function syncPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    await api.post('/profile/fcm-token', { token });
  } catch {
    // simulator / no network: the next start tries again
  }
}

/** Remove this device's push token from the account before signing out. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) await api.delete('/profile/fcm-token', { data: { token } });
  } catch {
    // signing out must never fail because of this
  }
}
