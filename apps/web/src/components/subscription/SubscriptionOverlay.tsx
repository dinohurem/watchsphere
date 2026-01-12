import { useNavigate } from 'react-router-dom';
import { Crown, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionOverlayProps {
  children: React.ReactNode;
  feature?: 'market' | 'orders' | 'home' | 'ai_chat';
  showOverlay?: boolean;
}

export function SubscriptionOverlay({ children, feature = 'market', showOverlay }: SubscriptionOverlayProps) {
  const navigate = useNavigate();
  const { canAccessFeature, loading, isTrial, daysRemaining } = useSubscription();

  // If explicitly told to show overlay or feature is not accessible
  const shouldShowOverlay = showOverlay ?? !canAccessFeature(feature);

  // Don't show overlay while loading
  if (loading) {
    return <>{children}</>;
  }

  // If has subscription or feature is accessible, show content normally
  if (!shouldShowOverlay) {
    return <>{children}</>;
  }

  // Show blurred content with upgrade prompt
  return (
    <div className="relative min-h-[400px]">
      {/* Blurred content */}
      <div className="filter blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-start justify-center pt-8 sm:pt-16 z-10">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6">
            <Crown className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {isTrial && daysRemaining > 0
              ? 'Your Trial is Ending Soon'
              : 'Subscription Required'}
          </h2>

          <p className="text-gray-600 mb-6">
            {isTrial && daysRemaining > 0
              ? `You have ${daysRemaining} days left in your trial. Upgrade now to continue accessing all features.`
              : 'Your subscription has expired. Upgrade to Premium to unlock access to the market, orders, and AI assistant.'}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/app/profile/billing')}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Upgrade to Premium
            </button>

            <p className="text-sm text-gray-500">
              Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simplified lock icon overlay for smaller components
export function LockedFeature({ children, message = 'Premium feature' }: { children: React.ReactNode; message?: string }) {
  const navigate = useNavigate();
  const { hasActiveSubscription, loading } = useSubscription();

  if (loading || hasActiveSubscription) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="filter blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      <button
        onClick={() => navigate('/app/profile/billing')}
        className="absolute inset-0 flex items-center justify-center bg-gray-900/10 rounded-lg"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm">
          <Lock className="w-4 h-4" />
          {message}
        </div>
      </button>
    </div>
  );
}
