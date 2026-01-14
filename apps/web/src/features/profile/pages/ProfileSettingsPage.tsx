import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import { User, CreditCard, Settings, ChevronRight, ChevronDown, LogOut, Crown, Check, Loader2, ShoppingBag, Sliders, FileText, HelpCircle, BookOpen, PlayCircle, AlertTriangle, Bug, Mail, Plus, ArrowLeft, Trash2, TrendingUp, TrendingDown, Tag } from 'lucide-react';
import { api } from '@/services/api';

// FAQ Data
const faqData = [
  {
    question: 'What is WatchSphere?',
    answer: 'WatchSphere is a comprehensive platform for watch collectors and dealers. It provides market data, price tracking, social features, and a marketplace for buying and selling luxury watches.',
  },
  {
    question: 'How do I add watches to my watchlist?',
    answer: "You can add watches to your watchlist by navigating to the Market section, finding a watch you're interested in, and clicking the heart icon. You can also set price alerts to be notified when a watch reaches your target price.",
  },
  {
    question: 'How do buy and sell orders work?',
    answer: "Buy orders let you post what watches you're looking to purchase along with your target price. Sell orders let you list watches you want to sell. Other users can browse these orders and reach out to you through the app's messaging feature.",
  },
  {
    question: 'How do I contact a seller or buyer?',
    answer: "When viewing a buy or sell order, you'll see options to contact the user via the in-app chat, WhatsApp, or Telegram (depending on what contact methods they've provided in their profile).",
  },
  {
    question: 'How is watch pricing data collected?',
    answer: 'Our pricing data is aggregated from multiple sources including authorized dealers, secondary market platforms, and auction results. We update prices regularly to provide the most accurate market information.',
  },
  {
    question: 'What should I do if I have a dispute with another user?',
    answer: 'If you have a dispute regarding a transaction, you can file a dispute through the Support section of the app. Go to Profile > Support > Disputes to create a new dispute. Our team will review and assist in resolving the issue.',
  },
  {
    question: 'How do I update my profile information?',
    answer: 'Go to Profile > Profile Settings to update your name, contact information, and profile photo. You can also add your WhatsApp and Telegram information so other users can contact you easily.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we take data security seriously. All communications are encrypted, and we never share your personal information with third parties without your consent. You can review our Privacy Policy for more details.',
  },
  {
    question: 'How do I report a bug or issue?',
    answer: 'You can report issues through Profile > Support > Report an Issue. Please provide as much detail as possible about the problem you encountered, and our team will investigate and work on a fix.',
  },
  {
    question: 'Can I delete my account?',
    answer: 'Yes, you can deactivate your account through Profile > Account Details > Delete Account. This will deactivate your account and you will no longer be able to log in. Your data will be retained for a period as required by law.',
  },
];

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

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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

  // Orders state
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Set active section based on URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('billing')) {
      setActiveSection('billing');
    } else if (path.includes('settings')) {
      setActiveSection('profile');
    } else {
      setActiveSection('profile');
    }
  }, [location.pathname]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load profile
      try {
        const profileResponse = await api.get('/profile/me');
        setProfile(profileResponse.data);
      } catch (error) {
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            name: user.name,
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
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      alert(error.response?.data?.detail || 'Failed to initiate subscription');
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
      alert('Issue Reported. Thank you for reporting this issue. Our team will investigate and work on a fix.');
      setIssueTitle('');
      setIssueDescription('');
      setSupportView('main');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to report issue. Please try again.');
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
      alert('Dispute Submitted. Your dispute has been submitted successfully. Our team will review it and get back to you.');
      setDisputeWatchRef('');
      setDisputeBrand('');
      setDisputeModel('');
      setDisputeDescription('');
      setSupportView('disputes');
      loadDisputes();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to submit dispute. Please try again.');
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
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'closed':
        return 'Closed';
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
        alert('Profile photo updated successfully!');
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveField = async (field: string, value: string) => {
    setSavingProfile(true);
    try {
      await api.patch('/profile/me', { [field]: value || null });
      setProfile(prev => prev ? { ...prev, [field]: value || null } : null);
      setEditingField(null);
      setEditValue('');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/profile/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      alert('Password changed successfully!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to change password. Please check your current password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This will deactivate your account and you will no longer be able to log in.')) {
      return;
    }

    setDeletingAccount(true);
    try {
      await api.post('/profile/deactivate');
      logout();
      navigate('/login');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete account. Please try again.');
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
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setBuyOrders([]);
      setSellOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const menuItems = [
    { id: 'profile' as const, label: 'Profile Settings', icon: User },
    { id: 'account' as const, label: 'Account Details', icon: Settings },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'orders' as const, label: 'Orders', icon: ShoppingBag },
    { id: 'general' as const, label: 'General', icon: Sliders },
    { id: 'terms' as const, label: 'Terms and Privacy', icon: FileText },
    { id: 'support' as const, label: 'Support', icon: HelpCircle },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      );
    }

    if (activeSection === 'orders') {
      // Load orders when this section is selected
      if (buyOrders.length === 0 && sellOrders.length === 0 && !loadingOrders) {
        loadOrders();
      }

      const renderOrderCard = (order: Order) => {
        const isPositive = order.priceChange >= 0;
        return (
          <div
            key={order.id}
            onClick={() => navigate(`/app/market/${encodeURIComponent(order.reference || order.id)}`)}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="h-36 bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
              {order.image ? (
                <img src={order.image} alt={order.brand} className="h-full object-contain" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                </div>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Orders</h2>
          <p className="text-gray-500 mb-6">View and manage your buy and sell orders</p>

          {loadingOrders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Buy Orders Section */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Buy Orders
                </h3>
                {buyOrders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {buyOrders.map(renderOrderCard)}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <ShoppingBag className="w-7 h-7 text-gray-400" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">No buy orders yet</h4>
                    <p className="text-gray-500 text-sm">Create buy orders to see them here</p>
                  </div>
                )}
              </div>

              {/* Sell Orders Section */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Sell Orders
                </h3>
                {sellOrders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sellOrders.map(renderOrderCard)}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <div className="w-14 h-14 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Tag className="w-7 h-7 text-gray-400" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">No sell orders yet</h4>
                    <p className="text-gray-500 text-sm">Create sell orders to see them here</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === 'general') {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">General Settings</h2>
          <p className="text-gray-500 mb-6">Manage your app preferences</p>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Notifications</h3>
                <p className="text-sm text-gray-500">Receive push notifications for updates</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Email Updates</h3>
                <p className="text-sm text-gray-500">Receive market updates via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
              </label>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'terms') {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Terms and Privacy</h2>
          <p className="text-gray-500 mb-6">Review our policies and terms</p>

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
                  <h3 className="font-medium text-gray-900">Terms of Service</h3>
                  <p className="text-sm text-gray-500">Read our terms and conditions</p>
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
                  <h3 className="font-medium text-gray-900">Privacy Policy</h3>
                  <p className="text-sm text-gray-500">Learn how we protect your data</p>
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
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Frequently Asked Questions</h2>
            <p className="text-gray-500 mb-6">Find answers to common questions about WatchSphere</p>

            <div className="space-y-4">
              {faqData.map((faq, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaqIndex === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaqIndex === index && (
                    <div className="px-6 pb-6">
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
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
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Help Center</h2>
            <p className="text-gray-500 mb-6">Find answers to common questions or take a guided tour</p>

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
                    <h3 className="font-medium text-gray-900">FAQ</h3>
                    <p className="text-sm text-gray-500">Frequently asked questions and answers</p>
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
                    <h3 className="font-medium text-gray-900">Demo</h3>
                    <p className="text-sm text-gray-500">Take a guided tour of the app</p>
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
                <span>Back</span>
              </button>
              <button
                onClick={() => setSupportView('new-dispute')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Dispute</span>
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Disputes</h2>
            <p className="text-gray-500 mb-6">View and manage your transaction disputes</p>

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
                <h3 className="font-semibold text-gray-900 mb-2">No disputes</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  You haven't filed any disputes yet. If you have an issue with a transaction, click the + button to create a new dispute.
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
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">File a Dispute</h2>
            <p className="text-gray-500 mb-6">Please provide details about the watch and the issue you're experiencing</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Watch Reference *</label>
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
                <label className="block text-sm font-semibold text-gray-900 mb-2">Brand (Optional)</label>
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
                <label className="block text-sm font-semibold text-gray-900 mb-2">Model (Optional)</label>
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
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description *</label>
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
                {submittingDispute ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Dispute'}
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
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Report an Issue</h2>
            <p className="text-gray-500 mb-6">Found a bug or experiencing a problem? Let us know and we'll work on fixing it.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
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
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description *</label>
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
                {submittingIssue ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit'}
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
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Get in Touch</h2>
            <p className="text-gray-500 mb-6">Have questions about WatchSphere? We're here to help. Reach out to us through any of the channels below.</p>

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
                    <h3 className="font-medium text-gray-900">Email Us</h3>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Support</h2>
          <p className="text-gray-500 mb-6">Get help, report issues, or file disputes</p>

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
                  <h3 className="font-medium text-gray-900">Help Center</h3>
                  <p className="text-sm text-gray-500">FAQ and guided tours</p>
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
                  <h3 className="font-medium text-gray-900">Disputes</h3>
                  <p className="text-sm text-gray-500">View and manage transaction disputes</p>
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
                  <h3 className="font-medium text-gray-900">Report an Issue</h3>
                  <p className="text-sm text-gray-500">Report bugs or problems</p>
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
                  <h3 className="font-medium text-gray-900">Contact</h3>
                  <p className="text-sm text-gray-500">Get in touch with us</p>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Details</h2>
          <p className="text-gray-500 mb-6">Manage your account settings and security preferences</p>

          {/* Account Fields */}
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-6">
            {/* Email (Read-only) */}
            <div className="p-6">
              <label className="block text-sm text-gray-500 mb-2">E-mail Address</label>
              <p className="text-gray-900">{profile?.email || 'No email set'}</p>
            </div>

            {/* Change Password */}
            <div className="p-6">
              <label className="block text-sm text-gray-500 mb-2">Change password</label>
              {showPasswordModal ? (
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
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
                      Cancel
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save
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
            <h3 className="font-semibold text-gray-900 mb-4">Danger Zone</h3>
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
                Delete Account
              </button>
              <p className="text-sm text-gray-500 text-center mt-3">
                This will deactivate your account. You will not be able to log in anymore.
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Billing & Subscription</h2>
          <p className="text-gray-500 mb-6">Manage your subscription plan and billing information</p>

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
                      {hasPaidSubscription ? `${planName} Subscription` : subscription?.is_trial ? 'Free Trial' : 'Free Plan'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {subscription?.has_subscription
                        ? subscription.is_trial
                          ? `Trial - ${subscription.trial_days_remaining} days remaining`
                          : hasPaidSubscription
                            ? `Expires: ${formatDate(subscription.expires_at)}`
                            : `${subscription.subscription_days_remaining} days remaining`
                        : 'No active subscription'}
                    </p>
                  </div>
                </div>
                {subscription?.has_subscription && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    subscription.status === 'active'
                      ? hasPaidSubscription ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {subscription.status === 'active' ? 'Active' : subscription.status}
                  </span>
                )}
              </div>
            </div>

            {subscription?.has_subscription ? (
              <div className="p-6 space-y-4">
                {hasPaidSubscription && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Plan</span>
                    <span className="font-medium text-purple-600">
                      {planName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monthly Price</span>
                  <span className="font-medium text-gray-900">
                    {subscription.is_trial ? 'Free (Trial)' : `${subscription.price_monthly?.toFixed(2)} ${subscription.currency}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{subscription.is_trial ? 'Trial Ends' : 'Active Until'}</span>
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
                      Upgrade to Premium
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Upgrade to Premium</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Get unlimited access to all features including advanced market analytics,
                    priority support, and exclusive deals.
                  </p>
                  <ul className="space-y-2 mb-4">
                    {['Unlimited watch tracking', 'Advanced price alerts', 'Market insights & analytics', 'Priority customer support'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
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
                      Processing...
                    </>
                  ) : (
                    'Subscribe Now'
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Settings</h2>
        <p className="text-gray-500 mb-6">Manage your personal information and contact preferences</p>

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
              {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {/* Name */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">Name</label>
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
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
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
            <label className="block text-sm text-gray-500 mb-2">Contact information</label>
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
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
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
            <label className="block text-sm text-gray-500 mb-2">WhatsApp Info</label>
            {editingField === 'whatsapp_phone' ? (
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
                  onClick={() => handleSaveField('whatsapp_phone', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('whatsapp_phone'); setEditValue(profile?.whatsapp_phone || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.whatsapp_phone ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.whatsapp_phone || 'Enter WhatsApp phone number'}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Telegram Info */}
          <div className="p-6">
            <label className="block text-sm text-gray-500 mb-2">Telegram Info</label>
            {editingField === 'telegram_username' ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="@username"
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveField('telegram_username', editValue)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditValue(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingField('telegram_username'); setEditValue(profile?.telegram_username || ''); }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className={profile?.telegram_username ? 'text-gray-900' : 'text-gray-400'}>
                  {profile?.telegram_username || 'Enter @username'}
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
                <p className="text-sm text-gray-500">Customer ID: {profile?.customer_id || 'N/A'}</p>
              </div>

              {/* Navigation */}
              <nav className="py-4 space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      activeSection === item.id
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
                ))}
              </nav>

              {/* Logout */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Log out</span>
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
    </div>
  );
}
