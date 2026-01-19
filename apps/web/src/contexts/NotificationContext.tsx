import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatWebSocket, NotificationData } from '@/services/chatWebSocket';
import { useAuthStore } from '@watchsphere/shared/stores';

interface NotificationContextType {
  notification: NotificationData | null;
  showNotification: (notification: NotificationData) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hideNotification = useCallback(() => {
    setNotification(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  const showNotification = useCallback((notif: NotificationData) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setNotification(notif);

    // Auto-hide after 5 seconds
    const id = setTimeout(() => {
      setNotification(null);
    }, 5000);
    setTimeoutId(id);
  }, [timeoutId]);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = chatWebSocket.onNotification((data) => {
      showNotification(data);
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, showNotification]);

  return (
    <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
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

// Notification Toast Component
export function NotificationToast() {
  const { notification, hideNotification } = useNotification();
  const navigate = useNavigate();

  if (!notification) return null;

  const handleClick = () => {
    if (notification.type === 'new_offer' && notification.orderId) {
      navigate(`/app/order/${notification.orderId}`);
    } else if (notification.reference) {
      navigate(`/app/watch/${encodeURIComponent(notification.reference)}`);
    }
    hideNotification();
  };

  const getIconConfig = () => {
    switch (notification.type) {
      case 'new_offer':
      case 'new_listing':
      case 'buy_order_offer':
        return { color: '#0088FF', bgColor: 'rgba(0, 136, 255, 0.1)' };
      case 'price_alert_up':
      case 'offer_accepted':
        return { color: '#4AA078', bgColor: 'rgba(74, 160, 120, 0.1)' };
      case 'price_alert_down':
      case 'offer_rejected':
      case 'price_undercut':
        return { color: '#D90429', bgColor: 'rgba(217, 4, 41, 0.1)' };
      default:
        return { color: '#0088FF', bgColor: 'rgba(0, 136, 255, 0.1)' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div
        onClick={handleClick}
        className="bg-white rounded-2xl shadow-lg border border-black/5 p-4 max-w-[360px] cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* WatchSphere Logo Icon - matching mobile notification banner */}
          <div className="w-10 h-10 rounded-[10px] overflow-hidden shrink-0 bg-gradient-to-b from-[#5BA3F5] to-[#2B7DE9] flex items-center justify-center">
            <svg width="24" height="20" viewBox="0 0 77 64" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M47.6224 29.5414H56.6389L58.6424 18.4562H63.6571L61.6535 29.5414H63.6718C70.6808 29.5416 76.3636 35.2013 76.3636 42.182C76.3635 49.1627 70.6807 54.8225 63.6718 54.8227H57.0851L55.4266 64H48.8347L47.1762 54.8227H30.7972L29.1387 64H22.5468L20.8883 54.8227H0.285159V49.9047H52.9591L55.7502 34.4586H48.5111L50.5146 45.5453H45.4984L40.6027 18.4562H45.6189L47.6224 29.5414ZM57.9738 49.9047H63.6718C67.9545 49.9045 71.4271 46.4475 71.4273 42.182C71.4273 37.9165 67.9546 34.4588 63.6718 34.4586H60.7648L57.9738 49.9047Z"
                fill="white"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.6533 9.17733H34.0322L35.6907 0H42.2826L43.9412 9.17733H60.3201L61.9786 0H66.9933L65.3348 9.17733H76.3636V14.0953H18.542L21.3345 29.5414H30.351L32.3545 18.4562H37.3707L32.4749 45.5453H27.4588L29.4623 34.4586H22.2232L24.2267 45.5453H19.2106L17.2071 34.4586H12.6903C5.68145 34.4583 0 28.7987 0 21.818C9.25611e-05 14.8545 5.65354 9.20536 12.6386 9.17733L10.9801 0H15.9948L17.6533 9.17733ZM13.5273 14.0953C9.02479 14.0953 4.93572 16.969 4.93562 21.818C4.93562 26.0834 8.40768 29.5411 12.6903 29.5414H16.3184L13.5273 14.0953Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#212121] truncate">
              {notification.title} {notification.reference}
            </p>
            <p className="text-[13px] text-[#626262] mt-0.5 line-clamp-2">
              {notification.body}
            </p>
            {notification.price && (
              <p className="text-[13px] font-medium text-[#212121] mt-1">
                {notification.currency === 'EUR' ? '€' : notification.currency}{notification.price.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              hideNotification();
            }}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
