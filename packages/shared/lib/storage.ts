import { StateStorage } from 'zustand/middleware';

/**
 * Storage adapter for Zustand persist middleware
 * This will be properly configured in each platform
 */
let storage: StateStorage | undefined;

export const setStorage = (storageImpl: StateStorage) => {
  storage = storageImpl;
};

export const getStorage = (): StateStorage => {
  if (!storage) {
    // Fallback to in-memory storage if no storage is set
    const memoryStorage: StateStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    return memoryStorage;
  }
  return storage;
};
