import { useState, useRef, KeyboardEvent, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type Step = 1 | 2 | 3;

interface OnboardingData {
  verificationCode: string;
  firstName: string;
  lastName: string;
  userName: string;
  role: string;
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(20);
  const [data, setData] = useState<OnboardingData>({
    verificationCode: '',
    firstName: '',
    lastName: '',
    userName: '',
    role: '',
  });

  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // Get roles from translations
  const ROLES = [
    { id: 'independent_dealer', label: t('auth.onboarding.roles.independentDealer') },
    { id: 'authorized_dealer', label: t('auth.onboarding.roles.authorizedDealer') },
  ];

  // Get quotes from translations
  const QUOTES = [
    {
      text: t('auth.onboarding.quotes.quote1'),
      author: t('auth.onboarding.quotes.author1'),
    },
    {
      text: t('auth.onboarding.quotes.quote2'),
      author: t('auth.onboarding.quotes.author2'),
    },
    {
      text: t('auth.onboarding.quotes.quote3'),
      author: t('auth.onboarding.quotes.author3'),
    },
  ];

  // Refs for verification code inputs
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown timer
  useEffect(() => {
    if (step === 1 && resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendCountdown]);

  // Auto-verify function
  const verifyCode = useCallback(async (code: string) => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-email', {
        code: code,
      });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.onboarding.invalidCode'));
      // Clear the code on error so user can re-enter
      setData(prev => ({ ...prev, verificationCode: '' }));
      // Focus the first input
      codeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [loading, t]);

  // Auto-verify when code is complete (6 digits)
  useEffect(() => {
    if (data.verificationCode.length === 6 && step === 1 && !loading) {
      verifyCode(data.verificationCode);
    }
  }, [data.verificationCode, step, loading, verifyCode]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = data.verificationCode.split('');
    newCode[index] = value;
    const updatedCode = newCode.join('');
    setData({ ...data, verificationCode: updatedCode });

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !data.verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      setData({ ...data, verificationCode: pastedData });
      // Focus the appropriate input after paste
      const focusIndex = Math.min(pastedData.length, 5);
      codeInputRefs.current[focusIndex]?.focus();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      navigate('/register');
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    try {
      await api.post('/auth/resend-verification');
      setError('');
      setResendCountdown(20);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.onboarding.resendFailed'));
    }
  };

  const handleNext = async () => {
    setError('');

    if (step === 2) {
      // Validate personal info
      if (!data.firstName.trim() || !data.lastName.trim()) {
        setError(t('auth.onboarding.fillAllFields'));
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Validate role selection and complete onboarding
      if (!data.role) {
        setError(t('auth.onboarding.selectRole'));
        return;
      }
      setLoading(true);
      try {
        const response = await api.post('/auth/complete-onboarding', {
          first_name: data.firstName,
          last_name: data.lastName,
          user_name: data.userName || undefined,
          role: data.role,
          watch_count: 0,
        });

        if (response.data.user) {
          setUser(response.data.user);
        }

        navigate('/app');
      } catch (err: any) {
        setError(err.response?.data?.detail || t('auth.onboarding.completeFailed'));
      } finally {
        setLoading(false);
      }
    }
  };

  const getBackgroundImage = () => {
    switch (step) {
      case 1:
        return '/images/auth-background-step1.png';
      case 2:
        return '/images/auth-background-step2.png';
      case 3:
        return '/images/auth-background-step3.png';
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="flex flex-col gap-6 sm:gap-10">
              <div className="flex flex-col gap-3 sm:gap-4">
                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  {t('auth.onboarding.verifyTitle')}
                </h1>
                <p className="text-[16px] sm:text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-6">
                  {t('auth.onboarding.verifyDescription')}{' '}
                  <span className="font-medium text-[#1d1d1f] break-all">{user?.email || t('auth.onboarding.yourEmail')}</span>
                </p>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-6 items-start">
                <div className="flex gap-1.5 sm:gap-2 w-full justify-center sm:justify-start" onPaste={handleCodePaste}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div
                      key={index}
                      className={`w-12 h-12 sm:w-16 sm:h-16 relative bg-white border border-[rgba(0,0,0,0.1)] rounded-xl sm:rounded-2xl overflow-hidden ${
                        loading ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        ref={(el) => (codeInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        disabled={loading}
                        value={data.verificationCode[index] || ''}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        className="absolute inset-0 w-full h-full text-center text-xl sm:text-2xl font-normal text-[#1d1d1f] bg-transparent focus:outline-none disabled:cursor-not-allowed"
                        style={{ lineHeight: '1.3' }}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-[14px] sm:text-[15px] text-[#1d1d1f] tracking-[-0.075px] leading-6">
                  {t('auth.onboarding.didntGetCode')}{' '}
                  {resendCountdown > 0 ? (
                    <span className="text-[rgba(29,29,31,0.5)]">
                      {t('auth.onboarding.resendIn')} 00:{resendCountdown.toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="text-[#1d1d1f] font-medium hover:underline"
                    >
                      {t('auth.onboarding.resend')}
                    </button>
                  )}
                </p>
              </div>
            </div>
            {/* Empty spacer to maintain consistent layout */}
            <div />
          </>
        );

      case 2:
        return (
          <>
            <div className="flex flex-col gap-6 sm:gap-10">
              <div className="flex flex-col gap-3 sm:gap-4">
                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  {t('auth.onboarding.personalInfoTitle')}
                </h1>
                <p className="text-[16px] sm:text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
                  {t('auth.onboarding.personalInfoDescription')}
                </p>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {/* First Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="firstName" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.onboarding.firstNameLabel')}<span className="text-[#c93927]">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={data.firstName}
                    onChange={(e) => setData({ ...data, firstName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder={t('auth.onboarding.firstNamePlaceholder')}
                  />
                </div>

                {/* Last Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastName" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.onboarding.lastNameLabel')}<span className="text-[#c93927]">*</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={data.lastName}
                    onChange={(e) => setData({ ...data, lastName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder={t('auth.onboarding.lastNamePlaceholder')}
                  />
                </div>

                {/* User Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="userName" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.onboarding.userNameLabel')}
                  </label>
                  <input
                    id="userName"
                    type="text"
                    value={data.userName}
                    onChange={(e) => setData({ ...data, userName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder={t('auth.onboarding.userNamePlaceholder')}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={loading}
              className="h-[44px] px-8 bg-[#ddd] border border-[rgba(29,29,31,0.1)] text-black text-[16px] font-semibold rounded-2xl hover:bg-[#ccc] focus:outline-none disabled:opacity-50 transition-colors tracking-[0.08px] leading-5 w-full sm:w-fit"
            >
              {t('auth.onboarding.continue')}
            </button>
          </>
        );

      case 3:
        return (
          <>
            <div className="flex flex-col gap-6 sm:gap-10">
              <div className="flex flex-col gap-3 sm:gap-4">
                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  {t('auth.onboarding.roleTitle')}
                </h1>
                <p className="text-[16px] sm:text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
                  {t('auth.onboarding.roleDescription')}
                </p>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setData({ ...data, role: role.id })}
                    className={`w-full h-[44px] px-4 text-left border rounded-2xl transition-all flex items-center ${
                      data.role === role.id
                        ? 'border-[#1d1d1f] bg-[#1d1d1f]/5'
                        : 'border-[rgba(29,29,31,0.1)] hover:border-[rgba(29,29,31,0.3)]'
                    }`}
                  >
                    <span className="text-[15px] font-medium text-[#1d1d1f] leading-[1.3]">{role.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={loading || !data.role}
              className="w-full h-[44px] bg-[#212121] text-white text-[16px] font-semibold rounded-full hover:bg-[#212121]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-50 transition-colors tracking-[0.08px] leading-5"
            >
              {loading ? t('auth.onboarding.completing') : t('auth.onboarding.complete')}
            </button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white relative">
      {/* Header - Mobile */}
      <div className="lg:hidden flex items-center justify-between px-5 py-5">
        <button
          onClick={handleBack}
          className="h-[44px] w-[44px] flex items-center justify-center bg-[#f0f0f0] rounded-full hover:bg-[#e0e0e0] transition-colors"
        >
          <svg className="w-5 h-5 text-[#404040]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
        <LanguageSwitcher />
      </div>

      {/* Logo - Desktop Centered */}
      <div className="hidden lg:block absolute top-5 left-1/2 -translate-x-1/2 z-10">
        <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
      </div>

      {/* Language Switcher - Desktop */}
      <div className="hidden lg:block absolute top-5 right-10 z-10">
        <LanguageSwitcher />
      </div>

      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col relative">
        {/* Back Button - Desktop positioned at left */}
        <div className="hidden lg:block absolute top-[18px] left-[141px]">
          <button
            onClick={handleBack}
            className="h-[44px] w-[44px] flex items-center justify-center bg-[#f0f0f0] rounded-full hover:bg-[#e0e0e0] transition-colors"
          >
            <svg className="w-5 h-5 text-[#404040]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col px-5 sm:px-8 py-8 lg:pt-[176px] lg:pb-[90px] lg:pl-[calc(50%-351px)] lg:pr-8">
          <div className="w-full max-w-[448px] mx-auto lg:mx-0 flex-1 flex flex-col justify-between gap-8">
            {renderStepContent()}
          </div>
        </div>
      </div>

      {/* Right Side - Image with Quote */}
      <div className="hidden lg:block w-[641px] py-[90px] pr-10">
        <div
          className="w-full h-[770px] rounded-3xl bg-cover bg-center relative overflow-hidden"
          style={{ backgroundImage: `url(${getBackgroundImage()})` }}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 rounded-3xl" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 46.688%, rgba(0,0,0,1) 100%)' }} />

          {/* Quote panel at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-8 rounded-b-3xl backdrop-blur-[5.6px] bg-[rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-6">
              <p className="text-white text-[32px] font-bold tracking-[0.4px] leading-[1.2]">
                {QUOTES[step - 1].text}
              </p>
              <p className="text-white text-[16px] font-normal">
                {QUOTES[step - 1].author}
              </p>
            </div>

            {/* Step indicators */}
            <div className="flex gap-2 mt-8 justify-center">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-[55px] h-[4px] rounded-sm ${
                    s === step ? 'bg-[rgba(255,255,255,0.8)]' : 'bg-[rgba(255,255,255,0.25)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Step indicators */}
      <div className="lg:hidden flex gap-2 justify-center pb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-[40px] h-[4px] rounded-sm ${
              s === step ? 'bg-[#1d1d1f]' : 'bg-[rgba(29,29,31,0.2)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
