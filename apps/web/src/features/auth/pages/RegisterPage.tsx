import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function RegisterPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        name: email.split('@')[0],
        role: 'collector',
      });

      // If registration returns user and token, go to onboarding
      if (response.data.user && response.data.access_token) {
        // Store tokens
        localStorage.setItem('auth_token', response.data.access_token);
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }

        login(response.data.user, response.data.access_token);
        navigate('/onboarding');
      } else {
        // Otherwise show success message (pending approval flow)
        setSuccess(true);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      // Handle Pydantic validation errors (array of objects) or string errors
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || e.message || String(e)).join(', '));
      } else if (typeof detail === 'object' && detail !== null) {
        setError(detail.msg || detail.message || JSON.stringify(detail));
      } else {
        setError(detail || t('auth.register.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-white">
        {/* Left Side */}
        <div className="flex-1 flex flex-col relative min-h-screen lg:min-h-0">
          {/* Header with Logo and Language Switcher */}
          <div className="flex items-center justify-between px-5 sm:px-10 py-5">
            <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
            <LanguageSwitcher />
          </div>

          {/* Success Message */}
          <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-8">
            <div className="w-full max-w-[450px] flex flex-col gap-6 sm:gap-8 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px]">
                {t('auth.register.successTitle')}
              </h1>
              <p className="text-[15px] text-[rgba(0,0,0,0.6)] leading-5">
                {t('auth.register.successMessage')}
              </p>
              <Link
                to="/login"
                className="w-full h-[44px] flex items-center justify-center bg-[#212121] text-white text-[16px] font-semibold rounded-full hover:bg-[#212121]/90 transition-colors tracking-[0.08px]"
              >
                {t('auth.register.goToLogin')}
              </Link>
            </div>

            {/* Footer Links */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              <Link to="/privacy" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
                {t('legal.privacyPolicy')}
              </Link>
              <Link to="/terms" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
                {t('legal.termsAndConditions')}
              </Link>
              <Link to="/contact" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
                {t('landing.footer.contact')}
              </Link>
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col relative min-h-screen lg:min-h-0">
        {/* Header with Logo and Language Switcher */}
        <div className="flex items-center justify-between px-5 sm:px-10 py-5">
          <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
          <LanguageSwitcher />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-[450px] flex flex-col gap-6 sm:gap-8">
            {/* Header */}
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
              {t('auth.register.title')}
            </h1>

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
                    {t('auth.register.emailLabel')}<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-2xl text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]/20"
                    placeholder={t('auth.register.emailPlaceholder')}
                  />
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.register.passwordLabel')}<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-2xl text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]/20"
                    placeholder={t('auth.register.passwordPlaceholder')}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] bg-[#212121] text-white text-[16px] font-semibold rounded-full hover:bg-[#212121]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-50 transition-colors tracking-[0.08px] leading-5"
              >
                {loading ? t('auth.register.creatingAccount') : t('auth.register.submitButton')}
              </button>

              {/* Login Link */}
              <p className="text-center text-[15px] text-[rgba(0,0,0,0.8)] leading-5">
                {t('auth.register.haveAccount')}{' '}
                <Link to="/login" className="font-semibold tracking-[0.075px] hover:underline">
                  {t('auth.register.logIn')}
                </Link>
              </p>
            </form>

            {/* Divider */}
            <p className="text-center text-[18px] text-[rgba(0,0,0,0.6)] leading-7 tracking-[-0.09px]">
              {t('auth.login.or')}
            </p>

            {/* Social Login Buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="w-full h-[44px] flex items-center justify-center gap-2 bg-white border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] sm:text-[16px] font-semibold text-[#1d1d1f] hover:bg-gray-50 transition-colors tracking-[0.08px] leading-5"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
                {t('auth.login.continueWithApple')}
              </button>

              <button
                type="button"
                className="w-full h-[44px] flex items-center justify-center gap-2 bg-white border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] sm:text-[16px] font-semibold text-[#1d1d1f] hover:bg-gray-50 transition-colors tracking-[0.08px] leading-5"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.login.continueWithGoogle')}
              </button>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            <Link to="/privacy" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
              {t('legal.privacyPolicy')}
            </Link>
            <Link to="/terms" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
              {t('legal.termsAndConditions')}
            </Link>
            <Link to="/contact" className="text-[13px] sm:text-[14px] font-medium text-[#1d1d1f]/70 hover:text-[#1d1d1f]">
              {t('landing.footer.contact')}
            </Link>
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
