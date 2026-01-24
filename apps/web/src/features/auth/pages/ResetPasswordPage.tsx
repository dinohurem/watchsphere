import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Check Icon Component
function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Eye Icon Component
function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Eye Off Icon Component
function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2047 20.84 15.19M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.4811 9.80385 14.1962C9.51897 13.9113 9.29439 13.572 9.14351 13.1984C8.99262 12.8249 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2219 9.18488 10.8539C9.34884 10.4859 9.58525 10.1547 9.88 9.88"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 1L23 23"
        stroke="rgba(29, 29, 31, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const code = location.state?.code || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if no email or code
  useEffect(() => {
    if (!email || !code) {
      navigate('/forgot-password');
    }
  }, [email, code, navigate]);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const canSubmit = isPasswordValid && passwordsMatch;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      if (!isPasswordValid) {
        setError(t('auth.resetPassword.requirementsError'));
        return;
      }
      if (!passwordsMatch) {
        setError(t('auth.resetPassword.matchError'));
        return;
      }
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        email,
        code,
        new_password: password,
      });

      setSuccess(true);
    } catch (err: any) {
      const message = err.response?.data?.detail || t('errors.generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordRequirement = (met: boolean, text: string) => (
    <div className="flex items-center gap-2">
      <CheckIcon color={met ? '#4AA078' : 'rgba(29, 29, 31, 0.2)'} />
      <span className={`text-[13px] ${met ? 'text-[#4AA078]' : 'text-[rgba(29,29,31,0.5)]'}`}>
        {text}
      </span>
    </div>
  );

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-white">
        <div className="flex-1 flex flex-col relative min-h-screen lg:min-h-0">
          {/* Header with Logo and Language Switcher */}
          <div className="flex items-center justify-between px-5 sm:px-10 py-5">
            <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
            <LanguageSwitcher />
          </div>

          {/* Success Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-8">
            <div className="w-full max-w-[450px] flex flex-col gap-6 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-[#4AA078] rounded-full flex items-center justify-center mx-auto">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="white"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h1 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
                {t('auth.resetPassword.successTitle')}
              </h1>
              <p className="text-[15px] sm:text-[17px] text-[rgba(29,29,31,0.6)] leading-[22px] tracking-[-0.43px]">
                {t('auth.resetPassword.successMessage')}
              </p>

              <button
                onClick={() => navigate('/login')}
                className="w-full h-[44px] bg-[#1d1d1f] text-white text-[16px] font-semibold rounded-full hover:bg-[#1d1d1f]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1d1d1f] transition-colors tracking-[0.08px] leading-5 mt-4"
              >
                {t('auth.resetPassword.signIn')}
              </button>
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

        {/* Back Button */}
        <div className="px-5 sm:px-10">
          <button
            onClick={() => navigate('/verify-reset-code', { state: { email } })}
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
                {t('auth.resetPassword.title')}
              </h1>
              <p className="text-[15px] sm:text-[17px] text-[rgba(29,29,31,0.6)] leading-[22px] tracking-[-0.43px]">
                {t('auth.resetPassword.description')}
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
              <div className="flex flex-col gap-5">
                {/* New Password Field */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="password" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.resetPassword.newPasswordLabel')}<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[48px] px-4 pr-12 border border-[rgba(29,29,31,0.05)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.4)] leading-5 tracking-[0.075px] focus:outline-none focus:border-2 focus:border-[#1d1d1f]"
                      placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="flex flex-col gap-2 py-1">
                  {renderPasswordRequirement(hasMinLength, t('auth.resetPassword.requirements.minLength'))}
                  {renderPasswordRequirement(hasUppercase, t('auth.resetPassword.requirements.uppercase'))}
                  {renderPasswordRequirement(hasLowercase, t('auth.resetPassword.requirements.lowercase'))}
                  {renderPasswordRequirement(hasNumber, t('auth.resetPassword.requirements.number'))}
                </div>

                {/* Confirm Password Field */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="confirmPassword" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                    {t('auth.resetPassword.confirmPasswordLabel')}<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-[48px] px-4 pr-12 border border-[rgba(29,29,31,0.05)] rounded-full text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.4)] leading-5 tracking-[0.075px] focus:outline-none focus:border-2 focus:border-[#1d1d1f]"
                      placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <CheckIcon color={passwordsMatch ? '#4AA078' : '#FF3B30'} />
                      <span className={`text-[13px] ${passwordsMatch ? 'text-[#4AA078]' : 'text-[#FF3B30]'}`}>
                        {passwordsMatch ? t('auth.resetPassword.passwordsMatch') : t('auth.resetPassword.passwordsDontMatch')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full h-[44px] bg-[#1d1d1f] text-white text-[16px] font-semibold rounded-full hover:bg-[#1d1d1f]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1d1d1f] disabled:bg-[rgba(33,33,33,0.05)] disabled:text-[rgba(29,29,31,0.4)] transition-colors tracking-[0.08px] leading-5"
              >
                {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submitButton')}
              </button>
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
