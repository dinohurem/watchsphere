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

/**
 * Initialize storage for mobile app
 * Call this before any stores are used
 */
export const initializeStorage = () => {
  setStorage(asyncStorageAdapter);
};
