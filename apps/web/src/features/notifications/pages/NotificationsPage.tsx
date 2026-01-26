import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tag, Check, X, Bell } from 'lucide-react';
import { api } from '@/services/api';

// Custom Price Change Down icon matching Figma design
function PriceChangeDownIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} style={style}>
      <path d="M1.25 7.08268L5.83333 11.666L10.8333 6.66602L18.3333 14.166L18.026 13.8586" stroke="currentColor" strokeWidth="1.66667" strokeMiterlimit="10" strokeLinecap="square"/>
      <path d="M12.5 14.166H18.3333V8.33268" stroke="currentColor" strokeWidth="1.66667" strokeMiterlimit="10" strokeLinecap="square"/>
    </svg>
  );
}

// Custom Price Change Up icon
function PriceChangeUpIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className={className} style={style}>
      <path d="M1.25 12.9173L5.83333 8.33398L10.8333 13.334L18.3333 5.83398L18.026 6.14135" stroke="currentColor" strokeWidth="1.66667" strokeMiterlimit="10" strokeLinecap="square"/>
      <path d="M12.5 5.83398H18.3333V11.6673" stroke="currentColor" strokeWidth="1.66667" strokeMiterlimit="10" strokeLinecap="square"/>
    </svg>
  );
}

type NotificationType = 'new_offer' | 'price_alert_up' | 'price_alert_down' | 'offer_accepted' | 'offer_rejected';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference: string | null;
  orderId: string | null;
  price: number | null;
  currency: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationResponse {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    reference: string | null;
    order_id: string | null;
    price: number | null;
    currency: string;
    is_read: boolean;
    created_at: string;
  }>;
  total: number;
  unread_count: number;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.time.justNow');
    if (diffMins < 60) return t('notifications.time.minAgo', { count: diffMins });
    if (diffHours < 24) return t('notifications.time.hourAgo', { count: diffHours });
    return t('notifications.time.dayAgo', { count: diffDays });
  };

  const loadNotifications = useCallback(async () => {
    try {
      let allNotifications: NotificationItem[] = [];

      // First, try to get user notifications
      try {
        const response = await api.get<NotificationResponse>('/notifications');
        const data = response.data;

        const mappedNotifications: NotificationItem[] = data.notifications.map((n) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          body: n.body,
          reference: n.reference,
          orderId: n.order_id,
          price: n.price,
          currency: n.currency,
          isRead: n.is_read,
          createdAt: n.created_at,
        }));

        allNotifications = [...mappedNotifications];
      } catch (error) {
        console.error('Failed to load user notifications:', error);
      }

      // Also try to get admin activity (for admins only)
      try {
        const activityResponse = await api.get('/activity/admin/activity?limit=50');
        if (activityResponse.data && activityResponse.data.length > 0) {
          const activityNotifications: NotificationItem[] = activityResponse.data
            // Only include activities that have a watch reference in metadata
            .filter((item: any) => item.metadata?.reference)
            .map((item: any) => ({
              id: `activity-${item.id}`,
              type: item.activity_type === 'price_alert' ? 'price_alert_down' as NotificationType :
                    item.activity_type === 'buy_order_placed' || item.activity_type === 'sell_order_placed' ? 'new_offer' as NotificationType :
                    'new_offer' as NotificationType,
              title: item.description || 'Activity',
              body: item.description || '',
              reference: item.metadata.reference,
              orderId: item.entity_id || null,
              price: item.metadata?.price || null,
              currency: item.metadata?.currency || 'EUR',
              isRead: true, // Activity items are considered "read"
              createdAt: item.created_at,
            }));

          // Merge and deduplicate by reference and timestamp
          const existingRefs = new Set(allNotifications.map(n => `${n.reference}-${n.createdAt}`));
          const uniqueActivity = activityNotifications.filter(
            a => !existingRefs.has(`${a.reference}-${a.createdAt}`)
          );
          allNotifications = [...allNotifications, ...uniqueActivity];
        }
      } catch {
        // Not admin or activity endpoint failed - that's okay
      }

      // Sort by createdAt descending
      allNotifications.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (item: NotificationItem) => {
    // Mark as read
    if (!item.isRead) {
      try {
        await api.post(`/notifications/${item.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate based on notification type
    if (item.type === 'new_offer' && item.orderId) {
      navigate(`/app/order/${item.orderId}`);
    } else if (item.reference) {
      navigate(`/app/watch/${encodeURIComponent(item.reference)}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIconConfig = (type: NotificationType) => {
    switch (type) {
      case 'new_offer':
        return {
          Icon: Tag,
          color: '#0088FF',
          bgColor: 'rgba(0, 136, 255, 0.05)',
        };
      case 'price_alert_up':
        return {
          Icon: PriceChangeUpIcon,
          color: '#4AA078',
          bgColor: 'rgba(74, 160, 120, 0.05)',
        };
      case 'offer_accepted':
        return {
          Icon: Check,
          color: '#4AA078',
          bgColor: 'rgba(74, 160, 120, 0.05)',
        };
      case 'price_alert_down':
        return {
          Icon: PriceChangeDownIcon,
          color: '#D90429',
          bgColor: 'rgba(217, 4, 41, 0.05)',
        };
      case 'offer_rejected':
        return {
          Icon: X,
          color: '#D90429',
          bgColor: 'rgba(217, 4, 41, 0.05)',
        };
      default:
        return {
          Icon: Tag,
          color: '#0088FF',
          bgColor: 'rgba(0, 136, 255, 0.05)',
        };
    }
  };

  // Separate notifications into new (unread) and earlier (read)
  const newNotifications = notifications.filter((n) => !n.isRead);
  const earlierNotifications = notifications.filter((n) => n.isRead);

  const renderNotificationItem = (item: NotificationItem, isLast: boolean) => {
    const iconConfig = getIconConfig(item.type);
    const IconComponent = iconConfig.Icon;

    const displayTitle =
      item.type === 'new_offer'
        ? t('notifications.newOffer')
        : item.type === 'price_alert_up'
        ? t('notifications.priceChangedFor')
        : item.type === 'price_alert_down'
        ? t('notifications.priceChangedFor')
        : item.title;

    const priceDisplay = item.price
      ? `${item.currency === 'EUR' ? '€' : item.currency} ${item.price.toLocaleString()}`
      : '';

    return (
      <div key={item.id}>
        <div
          onClick={() => handleNotificationPress(item)}
          className="flex items-center gap-3 p-4 rounded-2xl hover:bg-[rgba(29,29,31,0.02)] transition-colors cursor-pointer"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconConfig.bgColor }}
          >
            <IconComponent className="w-[18px] h-[18px]" style={{ color: iconConfig.color }} />
          </div>
          <div className="flex-1 min-w-0 flex items-center">
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-[15px] leading-[19px] tracking-[0.075px]">
                <span className="font-normal text-[#212121]">{displayTitle} </span>
                {item.reference && (
                  <span className="font-semibold text-[#212121]">{item.reference}</span>
                )}
              </p>
              {priceDisplay && (
                <p className="text-[15px] font-normal text-[#626262] leading-[19px] tracking-[0.075px]">
                  {priceDisplay}
                </p>
              )}
              <p className="text-[11px] font-normal text-[#747474] leading-[14px] tracking-[0.055px]">
                {formatTimeAgo(item.createdAt)}
              </p>
            </div>
            {!item.isRead && (
              <div className="w-2 h-2 rounded-full bg-[#C93927] ml-2.5 shrink-0" />
            )}
          </div>
        </div>
        {!isLast && (
          <div className="flex ml-[50px]">
            <div className="flex-1 h-px bg-[#E5E5EA]" />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-white min-h-screen">
        <div className="max-w-[600px] mx-auto">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]/80 mb-8">{t('notifications.title')}</h1>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-white min-h-screen">
      <div className="max-w-[600px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-[#1d1d1f]/80">{t('notifications.title')}</h1>
          {newNotifications.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-[#0088FF] hover:underline"
            >
              {t('notifications.markAllAsRead')}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-[#212121] mb-2">{t('notifications.noNotificationsTitle')}</h3>
            <p className="text-sm text-[#212121]/50">
              {t('notifications.noNotificationsDesc')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* NEW Section */}
            {newNotifications.length > 0 && (
              <div>
                <h2 className="text-[15px] font-medium text-[#626262] tracking-[0.075px] mb-3 px-4">
                  {t('notifications.new')}
                </h2>
                <div className="border border-black/5 rounded-2xl">
                  {newNotifications.map((item, index) =>
                    renderNotificationItem(item, index === newNotifications.length - 1)
                  )}
                </div>
              </div>
            )}

            {/* EARLIER Section */}
            {earlierNotifications.length > 0 && (
              <div>
                <h2 className="text-[15px] font-medium text-[#626262] tracking-[0.075px] mb-3 px-4">
                  {t('notifications.earlier')}
                </h2>
                <div className="border border-black/5 rounded-2xl">
                  {earlierNotifications.map((item, index) =>
                    renderNotificationItem(item, index === earlierNotifications.length - 1)
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
