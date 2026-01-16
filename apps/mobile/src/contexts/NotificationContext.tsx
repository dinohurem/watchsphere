import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NotificationData } from '@/components/NotificationBanner';

interface NotificationContextType {
  currentNotification: NotificationData | null;
  showNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => void;
  dismissNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<NotificationData[]>([]);

  const showNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const newNotification: NotificationData = {
      ...notification,
      id: `notif_${Date.now()}`,
      timestamp: new Date(),
    };

    // If there's already a notification showing, queue this one
    if (currentNotification) {
      setNotificationQueue(prev => [...prev, newNotification]);
    } else {
      setCurrentNotification(newNotification);
    }
  }, [currentNotification]);

  const dismissNotification = useCallback(() => {
    setCurrentNotification(null);

    // Show next notification in queue if any
    setTimeout(() => {
      setNotificationQueue(prev => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          setCurrentNotification(next);
          return rest;
        }
        return prev;
      });
    }, 300); // Small delay before showing next
  }, []);

  const value: NotificationContextType = {
    currentNotification,
    showNotification,
    dismissNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
