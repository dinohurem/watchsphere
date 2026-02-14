import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@watchsphere/shared/stores';
import { User, CreditCard, Settings, ChevronRight, ChevronDown, LogOut, Crown, Check, Loader2, ShoppingBag, Sliders, FileText, HelpCircle, BookOpen, PlayCircle, AlertTriangle, Bug, Mail, Plus, ArrowLeft, Trash2, TrendingUp, TrendingDown, Tag, Globe } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { useV2 } from '@/contexts/V2Context';

// FAQ Data keys (questions and answers are fetched via i18n)
const FAQ_COUNT = 10;

interface Dispute {
  id: string;
  watch_reference: string;
  watch_brand?: string;
  watch_model?: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
}

interface Order {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  image: string;
  status: string;
  orderType: 'buy' | 'sell';
}

interface SubscriptionStatus {
  has_subscription: boolean;
  status: string | null;
  plan: string | null;
  is_trial: boolean;
  trial_days_remaining: number;
  subscription_days_remaining: number;
  expires_at: string | null;
  price_monthly: number | null;
  currency: string | null;
  auto_renew: boolean | null;
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  telegram_username: string | null;
  profile_image_url: string | null;
  customer_id?: string;
}

type ActiveSection = 'profile' | 'account' | 'billing' | 'orders' | 'general' | 'terms' | 'support';

// General Settings Component
function GeneralSettings() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const languages = [
    { code: 'en', name: t('settings.english') },
    { code: 'de', name: t('settings.german') },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/profile/me');
      if (response.data) {
        setPushNotifications(response.data.notifications_enabled ?? true);
        setEmailNotifications(response.data.email_notifications_enabled ?? true);
        setPriceAlerts(response.data.notify_price_changes ?? true);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await api.patch('/profile/notifications', { [key]: value });
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handlePushChange = (checked: boolean) => {
    setPushNotifications(checked);
    updateSetting('notifications_enabled', checked);
  };

  const handleEmailChange = (checked: boolean) => {
    setEmailNotifications(checked);
    updateSetting('email_notifications_enabled', checked);
  };

  const handlePriceAlertsChange = (checked: boolean) => {
    setPriceAlerts(checked);
    updateSetting('notify_price_changes', checked);
  };

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setShowLanguageModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.generalSettings')}</h2>
      <p className="text-gray-500 mb-6">{t('settings.managePreferences')}</p>

      {/* Notifications Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{t('settings.pushNotifications')}</h3>
            <p className="text-sm text-gray-500">{t('settings.pushNotificationsDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={pushNotifications}
              onChange={(e) => handlePushChange(e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{t('settings.emailNotifications')}</h3>
            <p className="text-sm text-gray-500">{t('settings.emailNotificationsDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => handleEmailChange(e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{t('settings.priceAlerts')}</h3>
            <p className="text-sm text-gray-500">{t('settings.priceAlertsDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={priceAlerts}
              onChange={(e) => handlePriceAlertsChange(e.target.checked)}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
          </label>
        </div>
      </div>

      {/* Language Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">{t('settings.language')}</h3>
        </div>
        <button
          onClick={() => setShowLanguageModal(true)}
          className="w-full flex items-center justify-between py-3 text-left"
        >
          <div>
            <h4 className="font-medium text-gray-900">{t('settings.appLanguage')}</h4>
            <p className="text-sm text-gray-500">{t('settings.appLanguageDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{currentLanguage.name}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.selectLanguage')}</h3>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    i18n.language === lang.code
                      ? 'bg-gray-100 text-gray-900'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{lang.name}</span>
                  {i18n.language === lang.code && (
                    <Check className="w-5 h-5 text-gray-900" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowLanguageModal(false)}
              className="w-full mt-4 py-3 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);
  const { v2Enabled } = useV2();

  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  // Support subsection state
  const [supportView, setSupportView] = useState<'main' | 'help-center' | 'faq' | 'disputes' | 'new-dispute' | 'report-issue' | 'contact'>('main');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Report issue form state
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // New dispute form state
  const [disputeWatchRef, setDisputeWatchRef] = useState('');
  const [disputeBrand, setDisputeBrand] = useState('');
  const [disputeModel, setDisputeModel] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Profile editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion state
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Notification modal state
  const [notificationModal, setNotificationModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, title: '', message: '', type: 'success' });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotificationModal({
      show: true,
      title: type === 'success' ? 'Success' : 'Error',
      message,
      type,
    });
  };

  // Orders state
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [buyOrdersExpanded, setBuyOrdersExpanded] = useState(true);
  const [sellOrdersExpanded, setSellOrdersExpanded] = useState(true);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // Set active section based on URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('billing')) {
      setActiveSection('billing');
    } else if (path.includes('orders')) {
      setActiveSection('orders');
    } else if (path.includes('settings')) {
      setActiveSection('profile');
    } else {
      setActiveSection('profile');
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load profile
        try {
          const profileResponse = await api.get('/profile/me');
          setProfile(profileResponse.data);
          // Sync profile data to auth store for global access
          updateUser({
            name: profileResponse.data.name,
            profile_image_url: profileResponse.data.profile_image_url,
            profile_image_thumbnail_url: profileResponse.data.profile_image_thumbnail_url,
            phone: profileResponse.data.phone,
            whatsapp_phone: profileResponse.data.whatsapp_phone,
            telegram_username: profileResponse.data.telegram_username,
          });
        } catch (error) {
          // Use current user from store as fallback
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            setProfile({
              id: currentUser.id,
              email: currentUser.email,
              name: currentUser.name,
              phone: null,
              whatsapp_phone: null,
              telegram_username: null,
              profile_image_url: null,
            });
          }
        }

        // Load subscription status
        try {
          const subscriptionResponse = await api.get('/billing/subscription/status');
          setSubscription(subscriptionResponse.data);
        } catch (error) {
          console.error('Failed to load subscription:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);

      const response = await api.post('/billing/subscription/subscribe', {
        return_url: `${window.location.origin}/payment-callback?status=approved`,
        cancel_url: `${window.location.origin}/payment-callback?status=cancelled`,
      });

      // Redirect to Monri payment form
      if (response.data?.form_url && response.data?.form_data) {
        // Create a form and submit it
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = response.data.form_url;

        Object.entries(response.data.form_data).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      showNotification(error.response?.data?.detail || 'Failed to initiate subscription', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const loadDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const response = await api.get('/support/disputes');
      setDisputes(response.data || []);
    } catch (error) {
      console.error('Error loading disputes:', error);
      setDisputes([]);
    } finally {
      setLoadingDisputes(false);
    }
  };

  const handleSubmitIssue = async () => {
    if (!issueTitle.trim() || !issueDescription.trim()) return;

    setSubmittingIssue(true);
    try {
      await api.post('/support/issues', {
        title: issueTitle.trim(),
        description: issueDescription.trim(),
      });
      showNotification(t('settings.issueReported'));
      setIssueTitle('');
      setIssueDescription('');
      setSupportView('main');
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to report issue. Please try again.', 'error');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!disputeWatchRef.trim() || !disputeDescription.trim()) return;

    setSubmittingDispute(true);
    try {
      await api.post('/support/disputes', {
        watch_reference: disputeWatchRef.trim(),
        watch_brand: disputeBrand.trim() || null,
        watch_model: disputeModel.trim() || null,
        description: disputeDescription.trim(),
      });
      showNotification(t('settings.disputeSubmitted'));
      setDisputeWatchRef('');
      setDisputeBrand('');
      setDisputeModel('');
      setDisputeDescription('');
      setSupportView('disputes');
      loadDisputes();
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to submit dispute. Please try again.', 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return { bg: 'bg-orange-100', text: 'text-orange-600' };
      case 'in_progress':
        return { bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'closed':
        return { bg: 'bg-green-100', text: 'text-green-600' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'open':
        return t('settings.statusOpen');
      case 'in_progress':
        return t('settings.statusInProgress');
      case 'closed':
        return t('settings.statusClosed');
      default:
        return status;
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data) {
        setProfile(prev => prev ? {
          ...prev,
          profile_image_url: response.data.url,
        } : null);
        // Sync to auth store for global access
        updateUser({
          profile_image_url: response.data.url,
          profile_image_thumbnail_url: response.data.thumbnail_url || response.data.url,
        });
        showNotification(t('settings.photoUpdated'));
      }
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to upload photo. Please try again.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveField = async (field: string, value: string) => {
    setSavingProfile(true);
    try {
      await api.patch('/profile/me', { [field]: value || null });
      setProfile(prev => prev ? { ...prev, [field]: value || null } : null);
      // Sync relevant fields to auth store for global access
      if (['name', 'phone', 'whatsapp_phone', 'telegram_username'].includes(field)) {
        updateUser({ [field]: value || null });
      }
      setEditingField(null);
      setEditValue('');
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to update profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification(t('settings.fillAllFields'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification(t('settings.passwordsNoMatch'), 'error');
      return;
    }
    if (newPassword.length < 6) {
      showNotification(t('settings.passwordMinLength'), 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/profile/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      showNotification(t('settings.passwordChanged'));
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to change password. Please check your current password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('settings.deleteAccountConfirmMessage'))) {
      return;
    }

    setDeletingAccount(true);
    try {
      await api.post('/profile/deactivate');
      logout();
      navigate('/login');
    } catch (error: any) {
      showNotification(error.response?.data?.detail || 'Failed to delete account. Please try again.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await api.get('/orders/my-orders');
      if (response.data && Array.isArray(response.data)) {
        const buyOrdersData: Order[] = [];
        const sellOrdersData: Order[] = [];

        response.data.forEach((order: any) => {
          const formattedOrder: Order = {
            id: order.id || order._id,
            brand: order.brand || '',
            model: order.model || '',
            reference: order.reference || '',
            price: order.price || 0,
            priceChange: order.price_change || 0,
            image: order.cover_image || '',
            status: order.status || 'active',
            orderType: order.order_type as 'buy' | 'sell',
          };

          if (order.order_type === 'buy') {
            buyOrdersData.push(formattedOrder);
          } else if (order.order_type === 'sell') {
            sellOrdersData.push(formattedOrder);
          }
        });

        setBuyOrders(buyOrdersData);
        setSellOrders(sellOrdersData);
        setOrdersLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setBuyOrders([]);
      setSellOrders([]);
      setOrdersLoaded(true);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Reload orders when navigating back to this page (location.key changes)
  useEffect(() => {
    if (ordersLoaded && activeSection === 'orders') {
      loadOrders();
    }
  }, [location.key, ordersLoaded, activeSection]);

  const allMenuItems = [
    { id: 'profile' as const, label: t('settings.profileSettings'), icon: User },
    { id: 'account' as const, label: t('settings.accountDetails'), icon: Settings },
    { id: 'billing' as const, label: t('settings.billingSubscription'), icon: CreditCard },
    { id: 'orders' as const, label: t('settings.orders'), icon: ShoppingBag, v2Only: true },
    { id: 'general' as const, label: t('settings.general'), icon: Sliders },
    { id: 'terms' as const, label: t('settings.termsPrivacy'), icon: FileText },
    { id: 'support' as const, label: t('settings.support'), icon: HelpCircle },
  ];

  const menuItems = allMenuItems;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      );
    }

    if (activeSection === 'orders' && v2Enabled) {
      // Load orders when this section is selected
      if (!ordersLoaded && !loadingOrders) {
        loadOrders();
      }

      const renderOrderCard = (order: Order) => {
        const isPositive = order.priceChange >= 0;
        const isSold = order.status === 'sold';
        const isCompleted = order.status === 'completed';
        return (
          <div
            key={order.id}
            onClick={() => navigate(`/app/order/${order.id}`)}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative"
          >
            {/* Status Label - top right corner */}
            {isSold && (
              <span className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[rgba(201,57,39,0.1)] text-[#c93927]">
                {t('orderDetails.sold')}
              </span>
            )}
            {isCompleted && (
              <span className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[rgba(128,128,128,0.1)] text-[#666666]">
                {t('orderDetails.completed')}
              </span>
            )}
            <div className="h-36 bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
              {order.image ? (
                <img src={order.image} alt={order.brand} className="h-full object-contain" loading="lazy" />
              ) : (
                <ImagePlaceholder width={144} height={144} iconSize={48} borderRadius={0} className="bg-transparent" />
              )}
            </div>
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 text-sm truncate">{`${order.brand} ${order.model}`.trim()}</h4>
              <p className="text-xs text-gray-500 truncate">{order.reference}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="font-semibold text-gray-900">{order.price.toLocaleString('de-DE')}€</span>
                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(order.priceChange).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      };

      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.orders')}</h2>
          <p className="text-gray-500 mb-6">{t('settings.ordersDescription')}</p>

          {loadingOrders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Buy Orders Section */}
              <div>
                <button
                  onClick={() => setBuyOrdersExpanded(!buyOrdersExpanded)}
                  className="w-full font-semibold text-gray-900 flex items-center justify-between py-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    {t('settings.buyOrdersCount', { count: buyOrders.length })}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${buyOrdersExpanded ? '' : '-rotate-90'}`} />
                </button>
                {buyOrdersExpanded && (
                  <>
                    {buyOrders.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                        {buyOrders.map(renderOrderCard)}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mt-4">
                        <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <ShoppingBag className="w-7 h-7 text-gray-400" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{t('settings.noBuyOrdersYet')}</h4>
                        <p className="text-gray-500 text-sm">{t('settings.noBuyOrdersYet')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sell Orders Section */}
              <div>
                <button
                  onClick={() => setSellOrdersExpanded(!sellOrdersExpanded)}
                  className="w-full font-semibold text-gray-900 flex items-center justify-between py-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    {t('settings.sellOrdersCount', { count: sellOrders.length })}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${sellOrdersExpanded ? '' : '-rotate-90'}`} />
                </button>
                {sellOrdersExpanded && (
                  <>
                    {sellOrders.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                        {sellOrders.map(renderOrderCard)}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mt-4">
                        <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <Tag className="w-7 h-7 text-gray-400" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{t('settings.noSellOrdersYet')}</h4>
                        <p className="text-gray-500 text-sm">{t('settings.noSellOrdersYet')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === 'general') {
      return (
        <GeneralSettings />
      );
    }

    if (activeSection === 'terms') {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.termsPrivacy')}</h2>
          <p className="text-gray-500 mb-6">{t('settings.termsPrivacy')}</p>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/terms-conditions')}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.termsOfService')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.termsOfService')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate('/privacy-policy')}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.privacyPolicy')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.privacyPolicy')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      );
    }

    if (activeSection === 'support') {
      // FAQ View
      if (supportView === 'faq') {
        return (
          <div>
            <button
              onClick={() => setSupportView('help-center')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.faq')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.faq')}</p>

            <div className="space-y-4">
              {Array.from({ length: FAQ_COUNT }, (_, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="font-medium text-gray-900 pr-4">{t(`settings.faqItems.q${index + 1}`)}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaqIndex === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-6 pb-6">
                      <p className="text-gray-600 text-sm leading-relaxed">{t(`settings.faqItems.a${index + 1}`)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Help Center View
      if (supportView === 'help-center') {
        return (
          <div>
            <button
              onClick={() => setSupportView('main')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.helpCenter')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.helpCenter')}</p>

            <div className="space-y-4">
              <button
                onClick={() => setSupportView('faq')}
                className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{t('settings.faq')}</h3>
                    <p className="text-sm text-gray-500">{t('settings.faq')}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/app')}
                className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <PlayCircle className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{t('settings.helpCenter')}</h3>
                    <p className="text-sm text-gray-500">{t('settings.helpCenter')}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        );
      }

      // Disputes View
      if (supportView === 'disputes') {
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSupportView('main')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>{t('common.back')}</span>
              </button>
              <button
                onClick={() => setSupportView('new-dispute')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t('settings.newDispute')}</span>
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.disputes')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.disputes')}</p>

            {loadingDisputes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : disputes.length > 0 ? (
              <div className="space-y-4">
                {disputes.map((dispute) => {
                  const statusColors = getStatusColor(dispute.status);
                  const watchName = dispute.watch_brand && dispute.watch_model
                    ? `${dispute.watch_brand} ${dispute.watch_model}`
                    : dispute.watch_reference;

                  return (
                    <div key={dispute.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{watchName}</h3>
                          <p className="text-sm text-gray-500">Ref: {dispute.watch_reference}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusColors.bg} ${statusColors.text}`}>
                          {formatStatus(dispute.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{dispute.description}</p>
                      <p className="text-xs text-gray-400">{new Date(dispute.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">{t('settings.disputes')}</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  {t('settings.disputes')}
                </p>
              </div>
            )}
          </div>
        );
      }

      // New Dispute View
      if (supportView === 'new-dispute') {
        const isValidDispute = disputeWatchRef.trim() && disputeDescription.trim();

        return (
          <div>
            <button
              onClick={() => setSupportView('disputes')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.fileDispute')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.fileDispute')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.watchReference')} *</label>
                <input
                  type="text"
                  placeholder="e.g., 126610LN"
                  value={disputeWatchRef}
                  onChange={(e) => setDisputeWatchRef(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900"
                  disabled={submittingDispute}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.brand')}</label>
                <input
                  type="text"
                  placeholder="e.g., Rolex"
                  value={disputeBrand}
                  onChange={(e) => setDisputeBrand(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900"
                  disabled={submittingDispute}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.model')}</label>
                <input
                  type="text"
                  placeholder="e.g., Submariner"
                  value={disputeModel}
                  onChange={(e) => setDisputeModel(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900"
                  disabled={submittingDispute}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.description')} *</label>
                <textarea
                  placeholder="Please describe the issue in detail..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900 resize-none"
                  disabled={submittingDispute}
                />
              </div>

              <button
                onClick={handleSubmitDispute}
                disabled={!isValidDispute || submittingDispute}
                className={`w-full py-4 rounded-xl font-semibold transition-colors ${
                  isValidDispute && !submittingDispute
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submittingDispute ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('settings.submitDispute')}
              </button>
            </div>
          </div>
        );
      }

      // Report Issue View
      if (supportView === 'report-issue') {
        const isValidIssue = issueTitle.trim() && issueDescription.trim();

        return (
          <div>
            <button
              onClick={() => setSupportView('main')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.reportIssue')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.reportIssue')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.reportSubject')} *</label>
                <input
                  type="text"
                  placeholder="Brief summary of the issue"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900"
                  disabled={submittingIssue}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{t('settings.description')} *</label>
                <textarea
                  placeholder="Please describe the issue in detail. Include steps to reproduce if possible..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-gray-900 resize-none"
                  disabled={submittingIssue}
                />
              </div>

              <button
                onClick={handleSubmitIssue}
                disabled={!isValidIssue || submittingIssue}
                className={`w-full py-4 rounded-xl font-semibold transition-colors ${
                  isValidIssue && !submittingIssue
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submittingIssue ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('settings.submitReport')}
              </button>
            </div>
          </div>
        );
      }

      // Contact View
      if (supportView === 'contact') {
        return (
          <div>
            <button
              onClick={() => setSupportView('main')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.getInTouch')}</h2>
            <p className="text-gray-500 mb-6">{t('settings.getInTouch')}</p>

            <div className="space-y-4">
              <a
                href="mailto:info@watchsphere.io"
                className="w-full bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{t('settings.emailUs')}</h3>
                    <p className="text-sm text-gray-500">info@watchsphere.io</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </a>
            </div>
          </div>
        );
      }

      // Main Support View
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.support')}</h2>
          <p className="text-gray-500 mb-6">{t('settings.support')}</p>

          <div className="space-y-4">
            <button
              onClick={() => setSupportView('help-center')}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.helpCenter')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.helpCenter')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                setSupportView('disputes');
                loadDisputes();
              }}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.disputes')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.disputes')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => setSupportView('report-issue')}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bug className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.reportIssue')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.reportIssue')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => setSupportView('contact')}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{t('settings.contactLabel')}</h3>
                  <p className="text-sm text-gray-500">{t('settings.getInTouch')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      );
    }

    if (activeSection === 'account') {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.accountDetails')}</h2>
          <p className="text-gray-500 mb-6">{t('settings.accountDetails')}</p>

          {/* Account Fields */}
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-6">
            {/* Email (Read-only) */}
            <div className="p-6">
              <label className="block text-sm text-gray-500 mb-2">{t('settings.email')}</label>
              <p className="text-gray-900">{profile?.email || t('settings.noEmailSet')}</p>
            </div>

            {/* Change Password */}
            <div className="p-6">
              <label className="block text-sm text-gray-500 mb-2">{t('settings.changePassword')}</label>
              {showPasswordModal ? (
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder={t('settings.currentPassword')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    type="password"
                    placeholder={t('settings.newPassword')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    type="password"
                    placeholder={t('settings.confirmNewPassword')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPasswordModal(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-gray-400">••••••••</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="mt-8">
            <h3 className="font-semibold text-gray-900 mb-4">{t('settings.dangerZone')}</h3>
            <div className="bg-white rounded-2xl border border-red-100 p-6">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deletingAccount ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t('settings.deleteAccount')}
              </button>
              <p className="text-sm text-gray-500 text-center mt-3">
                {t('settings.deleteAccountDesc')}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'billing') {
      // Check if user has an active paid (non-trial) subscription
      const hasPaidSubscription = subscription?.has_subscription && !subscription.is_trial && subscription.status === 'active';
      const planName = subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free';

      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.billingSubscription')}</h2>
          <p className="text-gray-500 mb-6">{t('settings.billingSubscription')}</p>

          {/* Current Plan */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    hasPaidSubscription ? 'bg-purple-100' : 'bg-yellow-100'
                  }`}>
                    <Crown className={`w-6 h-6 ${hasPaidSubscription ? 'text-purple-600' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {hasPaidSubscription ? `${planName} Subscription` : subscription?.is_trial ? t('settings.freeTrial') : t('settings.freePlan')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {subscription?.has_subscription
                        ? subscription.is_trial
                          ? `Trial - ${subscription.trial_days_remaining} days remaining`
                          : hasPaidSubscription
                            ? `Expires: ${formatDate(subscription.expires_at)}`
                            : `${subscription.subscription_days_remaining} days remaining`
                        : t('settings.noActiveSubscription')}
                    </p>
                  </div>
                </div>
                {subscription?.has_subscription && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    subscription.status === 'active'
                      ? hasPaidSubscription ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {subscription.status === 'active' ? t('settings.active') : subscription.status}
                  </span>
                )}
              </div>
            </div>

            {subscription?.has_subscription ? (
              <div className="p-6 space-y-4">
                {hasPaidSubscription && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('settings.plan')}</span>
                    <span className="font-medium text-purple-600">
                      {planName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('settings.monthlyPrice')}</span>
                  <span className="font-medium text-gray-900">
                    {subscription.is_trial ? t('settings.freeTrialPrice') : `${subscription.price_monthly?.toFixed(2)} ${subscription.currency}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{subscription.is_trial ? t('settings.trialEnds') : t('settings.activeUntil')}</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(subscription.expires_at)}
                  </span>
                </div>

                {subscription.is_trial && (
                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {subscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {t('settings.upgradeToPremium')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{t('settings.upgradeToPremium')}</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {t('settings.upgradeToPremium')}
                  </p>
                  <ul className="space-y-2 mb-4">
                    {[t('settings.premiumFeatures.f1'), t('settings.premiumFeatures.f2'), t('settings.premiumFeatures.f3'), t('settings.premiumFeatures.f4')].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-gray-900">{subscription?.price_monthly?.toFixed(2) || '150.00'}</span>
                    <span className="text-gray-500">{subscription?.currency || 'EUR'}/month</span>
                  </div>
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('settings.processing')}
                    </>
                  ) : (
                    t('settings.subscribeNow')
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default profile settings
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('settings.profileSettings')}</h2>
        <p className="text-gray-500 mb-6">{t('settings.profileSettings')}</p>

        {/* Profile Photo */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {uploadingPhoto ? (
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            ) : profile?.profile_image_url ? (
              <img
                src={profile.profile_image_url}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-gray-400" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {uploadingPhoto ? t('settings.uploading') : t('settings.uploadPhoto')}
            </button>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {/* Name */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">{t('settings.name')}</label>
            {editingField === 'name' ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('name', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('name'); setEditValue(profile?.name || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.name ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.name || 'Enter your name'}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Contact Information (Phone) */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">{t('settings.contactInfo')}</label>
            {editingField === 'phone' ? (
              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('phone', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('phone'); setEditValue(profile?.phone || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.phone ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.phone || 'Enter phone number'}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* WhatsApp Info */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">{t('settings.whatsappInfo')}</label>
            {editingField === 'whatsapp_phone' ? (
              <div className="flex items-center gap-3">
                <input
                  type="tel"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={t('settings.whatsappPlaceholder')}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('whatsapp_phone', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('whatsapp_phone'); setEditValue(profile?.whatsapp_phone || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.whatsapp_phone ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.whatsapp_phone || t('settings.whatsappPlaceholder')}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Telegram Info */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">{t('settings.telegramInfo')}</label>
            {editingField === 'telegram_username' ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={t('settings.telegramPlaceholder')}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('telegram_username', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('telegram_username'); setEditValue(profile?.telegram_username || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.telegram_username ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.telegram_username || t('settings.telegramPlaceholder')}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              {/* User Info */}
              <div className="flex flex-col items-center pb-6 border-b border-gray-100">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-4">
                  {profile?.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{profile?.name || user?.name}</h2>
              </div>

              {/* Navigation */}
              <nav className="py-4 space-y-1">
                {menuItems.map((item) => {
                  const isDisabled = 'v2Only' in item && item.v2Only && !v2Enabled;
                  return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && setActiveSection(item.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : activeSection === item.id
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  );
                })}
              </nav>

              {/* Logout */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t('settings.logOut')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      {notificationModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 ${
              notificationModal.type === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {notificationModal.type === 'success' ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{notificationModal.title}</h3>
            <p className="text-gray-600 mb-6">{notificationModal.message}</p>
            <button
              onClick={() => setNotificationModal(prev => ({ ...prev, show: false }))}
              className="w-full py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
