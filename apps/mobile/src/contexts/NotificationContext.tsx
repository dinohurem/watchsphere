import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { NotificationData } from '@/components/NotificationBanner';
import { chatService } from '@/services/chatService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationContextType {
  currentNotification: NotificationData | null;
  showNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => void;
  dismissNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<NotificationData[]>([]);

  // Use ref to track current notification in callbacks without causing re-registration
  const currentNotificationRef = useRef<NotificationData | null>(null);
  useEffect(() => {
    currentNotificationRef.current = currentNotification;
  }, [currentNotification]);

  const showNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const newNotification: NotificationData = {
      ...notification,
      id: `notif_${Date.now()}`,
      timestamp: new Date(),
    };

    console.log('NotificationContext: showNotification called', newNotification.type, newNotification.title);

    // If there's already a notification showing, queue this one
    if (currentNotificationRef.current) {
      console.log('NotificationContext: Queueing notification (one already showing)');
      setNotificationQueue(prev => [...prev, newNotification]);
    } else {
      console.log('NotificationContext: Showing notification immediately');
      setCurrentNotification(newNotification);
    }
  }, []); // No dependencies - uses ref instead

  // Listen for real-time notifications via Socket.IO
  useEffect(() => {
    const handleNotification = (data: any) => {
      console.log('=== NotificationContext: Received notification:new event ===');
      console.log('NotificationContext: data.type:', data.type);
      console.log('NotificationContext: data.title:', data.title);
      console.log('NotificationContext: data.body:', data.body);
      console.log('NotificationContext: data.reference:', data.reference);
      console.log('NotificationContext: data.orderId:', data.orderId);

      // Map WebSocket notification to banner format
      // Handle all notification types appropriately
      let notifType: 'buy_offer' | 'message' | 'price_alert' = 'message';
      if (data.type === 'new_offer' || data.type === 'new_listing' || data.type === 'buy_order_offer' || data.type === 'offer_accepted') {
        notifType = 'buy_offer';
      } else if (data.type === 'price_undercut' || data.type === 'price_alert_up' || data.type === 'price_alert_down' || data.type === 'offer_rejected') {
        notifType = 'price_alert';
      }

      console.log('NotificationContext: mapped to notifType:', notifType);

      const bannerNotification = {
        type: notifType,
        title: data.title || 'Notification',
        body: data.body || '',
        reference: data.reference,
        orderId: data.orderId,
      };

      console.log('NotificationContext: calling showNotification with:', JSON.stringify(bannerNotification));

      showNotification(bannerNotification);
    };

    chatService.on('notification:new', handleNotification);
    console.log('NotificationContext: Registered notification:new listener');

    return () => {
      chatService.off('notification:new', handleNotification);
      console.log('NotificationContext: Unregistered notification:new listener');
    };
  }, [showNotification]);

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
