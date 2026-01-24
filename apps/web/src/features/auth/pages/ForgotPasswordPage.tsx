import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.forgotPassword.emailRequired'));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('auth.forgotPassword.invalidEmail'));
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      // Navigate to verification code screen
      navigate('/verify-reset-code', { state: { email } });
    } catch (err: any) {
      // Don't reveal if email exists or not for security
      // Always navigate to verification screen
      navigate('/verify-reset-code', { state: { email } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col relative min-h-screen lg:min-h-0">
        {/* Header with Logo and Language Switcher */}
        <div className="flex items-center justify-between px-5 sm:px-10 py-5">
          <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
          <LanguageSwitcher />
        </div>

        {/* Back Button */}
        <div className="px-5 sm:px-10">
          <button
            onClick={() => navigate('/login')}
            className="w-11 h-11 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="#1D1D1F"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-[450px] flex flex-col gap-6 sm:gap-8">
            {/* Header */}
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal mb-2">
                {t('auth.forgotPassword.title')}
              </h1>
              <p className="text-[15px] sm:text-[17px] text-[rgba(29,29,31,0.6)] leading-[22px] tracking-[-0.43px]">
                {t('auth.forgotPassword.description')}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.forgotPassword.emailLabel')}<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.4)] leading-5 tracking-[0.075px] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]"
                    placeholder={t('auth.forgotPassword.emailPlaceholder')}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full h-[44px] bg-[#1d1d1f] text-white text-[16px] font-semibold rounded-full hover:bg-[#1d1d1f]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1d1d1f] disabled:bg-[rgba(33,33,33,0.05)] disabled:text-[rgba(29,29,31,0.4)] transition-colors tracking-[0.08px] leading-5"
              >
                {loading ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submitButton')}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-[14px] text-[rgba(29,29,31,0.6)] leading-5">
                {t('auth.forgotPassword.rememberPassword')}{' '}
                <Link to="/login" className="font-semibold text-[#1d1d1f] tracking-[0.075px] hover:underline">
                  {t('auth.forgotPassword.signIn')}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block flex-1 py-[90px] pr-10">
        <div
          className="w-full h-full rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/auth-background-login.png)' }}
        />
      </div>
    </div>
  );
}
