import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface AppState {
  theme: Theme;
  sidebarOpen: boolean;
  notificationCount: number;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setNotificationCount: (count: number) => void;
  incrementNotifications: () => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'system',
  sidebarOpen: true,
  notificationCount: 0,

  setTheme: (theme) => set({ theme }),

  toggleSidebar: () => set((state) => ({
    sidebarOpen: !state.sidebarOpen
  })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setNotificationCount: (count) => set({ notificationCount: count }),

  incrementNotifications: () => set((state) => ({
    notificationCount: state.notificationCount + 1
  })),

  clearNotifications: () => set({ notificationCount: 0 }),
}));
