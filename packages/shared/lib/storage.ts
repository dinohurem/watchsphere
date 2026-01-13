import { StateStorage } from 'zustand/middleware';

/**
 * Storage adapter for Zustand persist middleware
 * This will be properly configured in each platform
 */
let storage: StateStorage | undefined;

export const setStorage = (storageImpl: StateStorage) => {
  storage = storageImpl;
};

/**
 * Returns a proxy storage that always delegates to the current storage implementation.
 * This allows storage to be set after stores are created.
 */
export const getStorage = (): StateStorage => {
  // Return a proxy that always looks up the current storage
  // This allows storage to be set after the store is created
  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!storage) {
        // Storage not initialized yet - this is expected during initial bundle load
        // The session restore logic will handle auth restoration from AsyncStorage directly
        return null;
      }
      return storage.getItem(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
      if (!storage) {
        return;
      }
      await storage.setItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
      if (!storage) {
        return;
      }
      await storage.removeItem(name);
    },
  };
};
