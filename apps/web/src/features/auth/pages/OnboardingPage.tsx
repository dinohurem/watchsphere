import { useState, FormEvent, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';

type Step = 1 | 2 | 3 | 4;

interface OnboardingData {
  verificationCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  role: string;
  watchCount: string;
}

const ROLES = [
  { id: 'beginner', label: 'Beginner', description: 'Just starting my watch journey' },
  { id: 'collector', label: 'Collector', description: 'Building my collection' },
  { id: 'blogger', label: 'Blogger / Journalist', description: 'Writing about watches' },
  { id: 'expert', label: 'Expert', description: 'Deep knowledge of horology' },
  { id: 'private_seller', label: 'Private Seller', description: 'Selling from my collection' },
  { id: 'commercial_dealer', label: 'Commercial Dealer', description: 'Professional watch dealer' },
];

export function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<OnboardingData>({
    verificationCode: '',
    firstName: '',
    lastName: '',
    gender: '',
    role: '',
    watchCount: '',
  });

  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // Refs for verification code inputs
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newCode = data.verificationCode.split('');
    newCode[index] = value;
    setData({ ...data, verificationCode: newCode.join('') });

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

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      navigate('/register');
    }
  };

  const handleNext = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');

    if (step === 1) {
      // Verify email code
      if (data.verificationCode.length !== 6) {
        setError('Please enter the 6-digit code');
        return;
      }
      setLoading(true);
      try {
        await api.post('/auth/verify-email', {
          code: data.verificationCode,
        });
        setStep(2);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Invalid verification code');
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      // Validate personal info
      if (!data.firstName.trim() || !data.lastName.trim()) {
        setError('Please fill in all required fields');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Validate role selection
      if (!data.role) {
        setError('Please select your role');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      // Complete onboarding
      setLoading(true);
      try {
        const response = await api.post('/auth/complete-onboarding', {
          first_name: data.firstName,
          last_name: data.lastName,
          gender: data.gender || undefined,
          role: data.role,
          watch_count: data.watchCount ? parseInt(data.watchCount) : 0,
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

  const handleSkip = () => {
    if (step === 4) {
      // Skip watch count and complete
      handleNext();
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F] tracking-wide">
                Verify Your Email
              </h1>
              <p className="mt-2 text-[15px] text-black/60">
                We've sent a 6-digit code to {user?.email || 'your email'}. Enter it below to verify your account.
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-[15px] font-semibold text-[#1D1D1F]">
                  Verification Code
                </label>
                <div className="flex gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (codeInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={data.verificationCode[index] || ''}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      className="w-14 h-14 text-center text-2xl font-semibold border border-[#1D1D1F]/10 rounded-2xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D1D1F] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <p className="text-center text-[15px] text-black/60">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.post('/auth/resend-verification');
                      setError('');
                      alert('Verification code resent!');
                    } catch (err: any) {
                      setError(err.response?.data?.detail || 'Failed to resend code');
                    }
                  }}
                  className="font-medium text-[#1D1D1F] hover:underline"
                >
                  Resend
                </button>
              </p>
            </form>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F] tracking-wide">
                Personal Info
              </h1>
              <p className="mt-2 text-[15px] text-black/60">
                Tell us a bit about yourself
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="firstName" className="block text-[15px] font-semibold text-[#1D1D1F]">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={data.firstName}
                    onChange={(e) => setData({ ...data, firstName: e.target.value })}
                    className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                    placeholder="Enter your first name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="lastName" className="block text-[15px] font-semibold text-[#1D1D1F]">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    value={data.lastName}
                    onChange={(e) => setData({ ...data, lastName: e.target.value })}
                    className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                    placeholder="Enter your last name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="gender" className="block text-[15px] font-semibold text-[#1D1D1F]">
                    Gender <span className="font-normal text-black/40">(Optional)</span>
                  </label>
                  <select
                    id="gender"
                    value={data.gender}
                    onChange={(e) => setData({ ...data, gender: e.target.value })}
                    className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20 appearance-none bg-white"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D1D1F] disabled:opacity-50 transition-colors"
              >
                Continue
              </button>
            </form>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F] tracking-wide">
                Select Your Role
              </h1>
              <p className="mt-2 text-[15px] text-black/60">
                How would you describe yourself in the watch community?
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-3">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setData({ ...data, role: role.id })}
                    className={`w-full p-4 text-left border rounded-2xl transition-all ${
                      data.role === role.id
                        ? 'border-[#1D1D1F] bg-[#1D1D1F]/5'
                        : 'border-[#1D1D1F]/10 hover:border-[#1D1D1F]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[15px] font-semibold text-[#1D1D1F]">{role.label}</p>
                        <p className="text-[13px] text-black/60">{role.description}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          data.role === role.id
                            ? 'border-[#1D1D1F] bg-[#1D1D1F]'
                            : 'border-[#1D1D1F]/30'
                        }`}
                      >
                        {data.role === role.id && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !data.role}
                className="w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D1D1F] disabled:opacity-50 transition-colors"
              >
                Continue
              </button>
            </form>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F] tracking-wide">
                Watch Count
              </h1>
              <p className="mt-2 text-[15px] text-black/60">
                How many watches do you currently own?
              </p>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleNext} className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor="watchCount" className="block text-[15px] font-semibold text-[#1D1D1F]">
                  Number of Watches
                </label>
                <input
                  id="watchCount"
                  type="number"
                  min="0"
                  value={data.watchCount}
                  onChange={(e) => setData({ ...data, watchCount: e.target.value })}
                  className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                  placeholder="Enter a number"
                />
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D1D1F] disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Completing...' : 'Complete'}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="w-full py-3.5 text-[16px] font-semibold text-[#1D1D1F] hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[15px] font-medium text-[#1D1D1F] hover:text-[#1D1D1F]/70 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <img src="/images/logo.svg" alt="WatchSphere" className="h-10" />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-[450px]">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 flex items-center justify-center">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s === step ? 'bg-[#1D1D1F]' : 'bg-[#1D1D1F]/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block w-[641px] p-[90px] pr-10">
        <div
          className="w-full h-full rounded-3xl bg-cover bg-center relative overflow-hidden"
          style={{ backgroundImage: 'url(/images/auth-background.png)' }}
        >
          {/* Overlay with quote */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <p className="text-[24px] font-medium leading-snug">
              "The best time to buy a watch was yesterday. The second best time is now."
            </p>
            <p className="mt-4 text-[14px] text-white/70">
              — WatchSphere Community
            </p>
          </div>

          {/* Step indicators */}
          <div className="absolute top-10 right-10 flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-1 rounded-full transition-colors ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
