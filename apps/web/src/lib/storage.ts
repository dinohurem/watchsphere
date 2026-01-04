import { StateStorage } from 'zustand/middleware';
import { setStorage } from '@watchsphere/shared/lib/storage';

/**
 * localStorage adapter for Zustand persist middleware
 * This wraps browser's localStorage to work with Zustand
 */
const localStorageAdapter: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
};

/**
 * Initialize storage for web app
 * Call this before any stores are used
 */
export const initializeStorage = () => {
  setStorage(localStorageAdapter);
};
