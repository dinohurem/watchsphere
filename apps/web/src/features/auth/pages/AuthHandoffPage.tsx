import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';

export function AuthHandoffPage() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const redeemToken = async () => {
      const token = searchParams.get('token');
      const redirect = searchParams.get('redirect') || '/app/profile/billing';

      if (!token) {
        setError(t('auth.handoff.invalidLink'));
        return;
      }

      try {
        // Redeem the handoff token for access/refresh tokens
        const response = await api.post('/auth/redeem-handoff', { token });
        const { user, access_token, refresh_token } = response.data;

        // Store tokens in localStorage
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        // Update auth store
        login(user, access_token);

        // Redirect to the intended page
        navigate(redirect, { replace: true });
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || t('auth.handoff.error');
        setError(errorDetail);
      }
    };

    redeemToken();
  }, [searchParams, navigate, login, t]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 sm:w-12 sm:h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-6">
            {t('auth.handoff.failed')}
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            {error}
          </p>
          <div className="mt-6 sm:mt-8 space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              {t('auth.handoff.goToLogin')}
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t('auth.handoff.goToHome')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 mx-auto">
          <svg className="animate-spin w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-6">
          {t('auth.handoff.signingIn')}
        </h1>
        <p className="text-gray-500 mt-2 text-sm sm:text-base">
          {t('auth.handoff.pleaseWait')}
        </p>
      </div>
    </div>
  );
}
