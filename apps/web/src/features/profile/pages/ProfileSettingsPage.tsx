import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import { Heart, User, CreditCard, Settings, ChevronRight, LogOut, Crown, Check, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

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

interface FavoriteWatch {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  price_change: number;
  image: string;
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  profile_image_url: string | null;
  customer_id?: string;
}

type ActiveSection = 'favorites' | 'profile' | 'account' | 'billing' | 'general';

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [activeSection, setActiveSection] = useState<ActiveSection>('favorites');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [favorites, setFavorites] = useState<FavoriteWatch[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  // Set active section based on URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('billing')) {
      setActiveSection('billing');
    } else if (path.includes('settings')) {
      setActiveSection('profile');
    } else {
      setActiveSection('favorites');
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
            profile_image_url: null,
          });
        }
      }

      // Load favorites/watchlist
      try {
        const watchlistResponse = await api.get('/profile/watchlist');
        if (watchlistResponse.data && Array.isArray(watchlistResponse.data)) {
          setFavorites(watchlistResponse.data.map((item: any) => ({
            id: item.id || item._id,
            brand: item.brand || '',
            model: item.model || '',
            reference: item.reference || '',
            price: item.target_price || item.price || 0,
            price_change: item.price_change || 0,
            image: item.image || item.cover_image || '',
          })));
        }
      } catch (error) {
        console.error('Failed to load watchlist:', error);
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

  const WatchCard = ({
    brand,
    model,
    reference,
    price,
    priceChange,
    image,
    onClick
  }: {
    brand: string;
    model: string;
    reference: string;
    price: number;
    priceChange: number;
    image: string;
    onClick: () => void;
  }) => {
    const isPositive = priceChange >= 0;

    return (
      <button
        onClick={onClick}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow text-left"
      >
        <div className="h-36 bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
          {image ? (
            <img
              src={image}
              alt={`${brand} ${model}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImagePlaceholder width={80} height={80} borderRadius={0} />
          )}
        </div>

        <div className="p-4 space-y-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm truncate">
              {brand} {model}
            </p>
            <p className="text-sm text-gray-500 truncate">{reference}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">
              {price.toLocaleString()}€
            </p>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
              isPositive ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-green-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs font-semibold ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(priceChange).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const menuItems = [
    { id: 'favorites' as const, label: 'Favorites', icon: Heart },
    { id: 'profile' as const, label: 'Profile Settings', icon: User },
    { id: 'account' as const, label: 'Account Details', icon: Settings, hasArrow: true },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard, hasArrow: true },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      );
    }

    if (activeSection === 'favorites') {
      return (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Watchlist</h2>
          <p className="text-gray-500 mb-6">Manage your personal information and contact preferences</p>

          {favorites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {favorites.map((watch) => (
                <WatchCard
                  key={watch.id}
                  brand={watch.brand}
                  model={watch.model}
                  reference={watch.reference}
                  price={watch.price}
                  priceChange={watch.price_change}
                  image={watch.image}
                  onClick={() => watch.reference && navigate(`/app/watch/${watch.reference}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No favorites yet</h3>
              <p className="text-gray-500 text-sm">Add watches to your watchlist to see them here</p>
            </div>
          )}
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
        <p className="text-gray-500 mb-6">Manage your personal information and preferences</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={profile?.name || ''}
              readOnly
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              readOnly
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
            />
          </div>
          {profile?.customer_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer ID</label>
              <input
                type="text"
                value={profile.customer_id}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
              />
            </div>
          )}
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
                    {item.hasArrow && (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
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
