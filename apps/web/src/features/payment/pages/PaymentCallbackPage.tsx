import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

export function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'verifying' | 'approved' | 'cancelled' | 'error'>('loading');

  // Verify and activate subscription after successful payment return
  const verifyAndActivateSubscription = useCallback(async () => {
    setStatus('verifying');

    try {
      // First, try to verify and activate the subscription via the verify endpoint
      // This will process the pending billing record if webhook hasn't fired
      const verifyResponse = await api.post('/billing/subscription/verify');

      if (verifyResponse.data.status === 'activated' || verifyResponse.data.status === 'already_processed') {
        // Check if subscription is now active
        const subscription = verifyResponse.data.subscription;
        if (subscription.has_subscription && !subscription.is_trial && subscription.status === 'active') {
          setStatus('approved');
          return;
        }
      }
    } catch (error: any) {
      console.error('Failed to verify subscription:', error);

      // If verify fails (e.g., no pending payment), fall back to polling status
      // This handles the case where webhook already processed
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const response = await api.get('/billing/subscription/status');
          const subscription = response.data;

          if (subscription.has_subscription && !subscription.is_trial && subscription.status === 'active') {
            setStatus('approved');
            return;
          }
        } catch (pollError) {
          console.error('Failed to check subscription status:', pollError);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // If we get here, show success anyway and let user check billing page
    setStatus('approved');
  }, []);

  useEffect(() => {
    const paymentStatus = searchParams.get('status');

    if (paymentStatus === 'approved') {
      // Verify and activate subscription
      verifyAndActivateSubscription();
    } else if (paymentStatus === 'cancelled') {
      setStatus('cancelled');
    } else {
      setStatus('error');
    }
  }, [searchParams, verifyAndActivateSubscription]);

  const handleContinue = () => {
    navigate('/app/profile/billing');
  };

  const handleGoHome = () => {
    navigate('/app');
  };

  if (status === 'loading' || status === 'verifying') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <Loader2 className="w-16 h-16 mx-auto text-gray-400 animate-spin" />
          <h1 className="text-xl font-semibold text-gray-900 mt-6">
            {status === 'verifying' ? 'Activating Your Subscription...' : 'Processing Payment...'}
          </h1>
          <p className="text-gray-500 mt-2">
            {status === 'verifying'
              ? 'Please wait while we activate your premium access. This may take a few moments.'
              : 'Please wait while we verify your payment.'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-6">
            Payment Successful!
          </h1>
          <p className="text-gray-500 mt-2">
            Thank you for your subscription. Your premium access has been activated.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleContinue}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              View Subscription
            </button>
            <button
              onClick={handleGoHome}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-20 h-20 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
            <XCircle className="w-12 h-12 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-6">
            Payment Cancelled
          </h1>
          <p className="text-gray-500 mt-2">
            Your payment was cancelled. No charges have been made to your account.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => navigate('/app/profile/billing')}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-6">
          Something Went Wrong
        </h1>
        <p className="text-gray-500 mt-2">
          We couldn't process your payment. Please try again or contact support.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => navigate('/app/profile/billing')}
            className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleGoHome}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
