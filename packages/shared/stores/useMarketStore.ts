import { create } from 'zustand';

export interface Watch {
  id: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  condition: 'new' | 'excellent' | 'good' | 'fair';
  year: number;
  serialNumber?: string;
  images: string[];
  dealer: {
    id: string;
    name: string;
    verified: boolean;
  };
}

interface MarketFilters {
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: Watch['condition'];
  year?: number;
}

interface MarketState {
  watches: Watch[];
  filters: MarketFilters;
  sortBy: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
  viewMode: 'grid' | 'list';

  // Actions
  setWatches: (watches: Watch[]) => void;
  addWatch: (watch: Watch) => void;
  updateWatch: (id: string, updates: Partial<Watch>) => void;
  removeWatch: (id: string) => void;
  setFilters: (filters: MarketFilters) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: MarketState['sortBy']) => void;
  setViewMode: (viewMode: 'grid' | 'list') => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  watches: [],
  filters: {},
  sortBy: 'newest',
  viewMode: 'grid',

  setWatches: (watches) => set({ watches }),

  addWatch: (watch) => set((state) => ({
    watches: [...state.watches, watch]
  })),

  updateWatch: (id, updates) => set((state) => ({
    watches: state.watches.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    ),
  })),

  removeWatch: (id) => set((state) => ({
    watches: state.watches.filter((w) => w.id !== id),
  })),

  setFilters: (filters) => set({ filters }),

  clearFilters: () => set({ filters: {} }),

  setSortBy: (sortBy) => set({ sortBy }),

  setViewMode: (viewMode) => set({ viewMode }),
}));
