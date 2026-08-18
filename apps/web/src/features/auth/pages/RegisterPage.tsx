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
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Handle OAuth success
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        whatsapp_phone: whatsappPhone,
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
                {/* WhatsApp Number Field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="whatsapp_phone" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.register.whatsappLabel')}<span className="text-red-500">*</span>
                  </label>
                  <input
                    id="whatsapp_phone"
                    name="whatsapp_phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-2xl text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]/20"
                    placeholder="+387 61 123 456"
                  />
                  <p className="text-[13px] text-[rgba(29,29,31,0.6)]">
                    {t('auth.register.whatsappHint')}
                  </p>
                </div>

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
