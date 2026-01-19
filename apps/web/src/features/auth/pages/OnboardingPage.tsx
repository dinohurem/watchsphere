import { useState, useRef, KeyboardEvent, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';

type Step = 1 | 2 | 3;

interface OnboardingData {
  verificationCode: string;
  firstName: string;
  lastName: string;
  userName: string;
  role: string;
}

const ROLES = [
  { id: 'independent_dealer', label: 'Independent Watch Dealer' },
  { id: 'authorized_dealer', label: 'Authorized Dealer (AD)' },
];

const QUOTES = [
  {
    text: '"A gentleman\'s choice of timepiece says as much about him as does his Saville Row suit,"',
    author: 'Ian Fleming',
  },
  {
    text: '"You never really own a Patek Philippe. You simply look after it for the next generation".',
    author: 'Patek Philippe',
  },
  {
    text: '"Everyone looks at your watch and it represents who you are, your values and your personal style."',
    author: 'Kobe Bryant',
  },
];

export function OnboardingPage() {
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
      setError(err.response?.data?.detail || 'Invalid verification code');
      // Clear the code on error so user can re-enter
      setData(prev => ({ ...prev, verificationCode: '' }));
      // Focus the first input
      codeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [loading]);

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
      setError(err.response?.data?.detail || 'Failed to resend code');
    }
  };

  const handleNext = async () => {
    setError('');

    if (step === 2) {
      // Validate personal info
      if (!data.firstName.trim() || !data.lastName.trim()) {
        setError('Please fill in all required fields');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Validate role selection and complete onboarding
      if (!data.role) {
        setError('Please select your role');
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
        setError(err.response?.data?.detail || 'Failed to complete onboarding');
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
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-4">
                <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  Verify your email
                </h1>
                <p className="text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-6">
                  Enter the 6 digit code we sent to{' '}
                  <span className="font-medium text-[#1d1d1f]">{user?.email || 'your email'}</span>
                </p>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-6 items-start">
                <div className="flex gap-1.5" onPaste={handleCodePaste}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div
                      key={index}
                      className={`w-16 h-16 relative bg-white border border-[rgba(0,0,0,0.1)] rounded-2xl overflow-hidden ${
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
                        className="absolute inset-0 w-full h-full text-center text-2xl font-normal text-[#1d1d1f] bg-transparent focus:outline-none disabled:cursor-not-allowed"
                        style={{ lineHeight: '1.3' }}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-[15px] text-[#1d1d1f] tracking-[-0.075px] leading-6">
                  Didn't get the code?{' '}
                  {resendCountdown > 0 ? (
                    <span className="text-[rgba(29,29,31,0.5)]">
                      Resend in 00:{resendCountdown.toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="text-[#1d1d1f] font-medium hover:underline"
                    >
                      Resend
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
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-4">
                <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  Tell us who you are
                </h1>
                <p className="text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
                  Add your name, last name, and optionally your user name to personalize your experience.
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
                    First Name<span className="text-[#c93927]">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={data.firstName}
                    onChange={(e) => setData({ ...data, firstName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder="Enter your first name"
                  />
                </div>

                {/* Last Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastName" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    Last Name<span className="text-[#c93927]">*</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={data.lastName}
                    onChange={(e) => setData({ ...data, lastName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder="Enter your last name"
                  />
                </div>

                {/* User Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="userName" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    User Name
                  </label>
                  <input
                    id="userName"
                    type="text"
                    value={data.userName}
                    onChange={(e) => setData({ ...data, userName: e.target.value })}
                    className="w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:border-[#1d1d1f] focus:border-2"
                    placeholder="Enter your user name"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={loading}
              className="h-[44px] px-8 bg-[#ddd] border border-[rgba(29,29,31,0.1)] text-black text-[16px] font-semibold rounded-2xl hover:bg-[#ccc] focus:outline-none disabled:opacity-50 transition-colors tracking-[0.08px] leading-5 w-fit"
            >
              Continue
            </button>
          </>
        );

      case 3:
        return (
          <>
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-4">
                <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                  Which best describes your role in the watch market?
                </h1>
                <p className="text-[18px] text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
                  Choose the role that best matches your business.
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
              {loading ? 'Completing...' : 'Complete'}
            </button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-white relative">
      {/* Logo - Centered at the very top of the entire viewport */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
        <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
      </div>

      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col relative">
        {/* Back Button - positioned at left */}
        <div className="absolute top-[18px] left-[141px]">
          <button
            onClick={handleBack}
            className="h-[44px] w-[44px] flex items-center justify-center bg-[#f0f0f0] rounded-full hover:bg-[#e0e0e0] transition-colors"
          >
            <svg className="w-5 h-5 text-[#404040]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Form Container - positioned to the left of center */}
        <div className="flex-1 flex flex-col pt-[176px] pb-[90px]" style={{ paddingLeft: 'calc(50% - 351px)', paddingRight: '32px' }}>
          <div className="w-[448px] flex-1 flex flex-col justify-between">
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
    </div>
  );
}
