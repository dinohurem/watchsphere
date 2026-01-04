import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';
import { setStorage } from '@watchsphere/shared/lib/storage';

/**
 * AsyncStorage adapter for Zustand persist middleware
 * This wraps React Native's AsyncStorage to work with Zustand
 */
const asyncStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(name);
      return value;
    } catch (error) {
      console.error('Error reading from AsyncStorage:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.error('Error writing to AsyncStorage:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
    }
  },
};

// Auto-initialize storage when this module is imported
// This ensures storage is set before any stores are created
setStorage(asyncStorageAdapter);

/**
 * Initialize storage for mobile app
 * This is now a no-op since storage is auto-initialized,
 * but kept for backward compatibility
 */
export const initializeStorage = () => {
  // Storage is already initialized when this module is imported
};
