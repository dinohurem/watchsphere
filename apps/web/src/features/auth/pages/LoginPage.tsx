import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Mirrors EMAIL_OTP_RESEND_COOLDOWN_SECONDS on the server.
const RESEND_COOLDOWN_SECONDS = 60;

const INPUT_CLASS =
  'w-full h-[44px] px-4 border border-[rgba(29,29,31,0.1)] rounded-2xl text-[15px] text-[#1d1d1f] placeholder:text-[rgba(29,29,31,0.6)] leading-5 tracking-[0.075px] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]/20 disabled:bg-[rgba(29,29,31,0.04)] disabled:text-[rgba(29,29,31,0.6)]';

export function LoginPage() {
  const { t } = useTranslation();
  // Two login modes, matching the mobile app: email + password, and
  // passwordless. In passwordless mode the WhatsApp number identifies the
  // account and the code is emailed to the address on it — the number is an
  // identifier, never a destination.
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [signInCode, setSignInCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const finishLogin = (user: any, accessToken: string, refreshToken?: string) => {
    localStorage.setItem('auth_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    login(user, accessToken);
    navigate(user.role === 'admin' ? '/admin' : '/app');
  };

  const handlePasswordLogin = async () => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await api.post('/auth/login', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { user, access_token, refresh_token } = response.data;
    finishLogin(user, access_token, refresh_token);
  };

  const handleSendCode = async () => {
    await api.post('/auth/passwordless/request-code', { whatsapp_phone: whatsappPhone });
    setCodeSent(true);
    setResendTimer(RESEND_COOLDOWN_SECONDS);
    // The server replies identically for unknown numbers and never names the
    // address it emailed. This wording must leak neither.
    setNotice(t('auth.login.codeSentNotice'));
  };

  const handleCodeLogin = async () => {
    const response = await api.post('/auth/passwordless/verify-code', {
      whatsapp_phone: whatsappPhone,
      code: signInCode,
    });
    const { user, access_token, refresh_token } = response.data;
    finishLogin(user, access_token, refresh_token);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (mode === 'password') {
        await handlePasswordLogin();
      } else if (codeSent) {
        await handleCodeLogin();
      } else {
        await handleSendCode();
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || t('auth.login.failed');

      if (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('pending approval')) {
        setError(t('auth.login.pendingApproval'));
      } else {
        setError(typeof errorDetail === 'string' ? errorDetail : t('auth.login.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await handleSendCode();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.login.codeSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'password' | 'code') => {
    setMode(next);
    setError('');
    setNotice('');
    setCodeSent(false);
    setSignInCode('');
    setResendTimer(0);
  };

  const useDifferentNumber = () => {
    setCodeSent(false);
    setSignInCode('');
    setResendTimer(0);
    setNotice('');
  };

  const submitLabel = loading
    ? t('auth.login.loggingIn')
    : mode === 'password'
      ? t('auth.login.submitButton')
      : codeSent
        ? t('auth.login.verifyAndSignIn')
        : t('auth.login.sendCode');

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
              {t('auth.login.title')}
            </h1>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Neutral notice (code sent) */}
            {notice && !error && (
              <div className="rounded-2xl bg-[rgba(29,29,31,0.04)] p-4 border border-[rgba(29,29,31,0.08)]">
                <p className="text-sm text-[#1d1d1f]">{notice}</p>
              </div>
            )}

            {/* Mode switch: password vs emailed sign-in code */}
            <div className="flex p-1 bg-[rgba(29,29,31,0.06)] rounded-full">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className={`flex-1 h-[36px] rounded-full text-[14px] font-semibold tracking-[0.075px] transition-colors ${
                  mode === 'password' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[rgba(29,29,31,0.6)]'
                }`}
              >
                {t('auth.login.modePassword')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('code')}
                className={`flex-1 h-[36px] rounded-full text-[14px] font-semibold tracking-[0.075px] transition-colors ${
                  mode === 'code' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[rgba(29,29,31,0.6)]'
                }`}
              >
                {t('auth.login.modeCode')}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                {mode === 'password' ? (
                  <>
                    {/* Email Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                        {t('auth.login.emailLabel')}
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder={t('auth.login.emailPlaceholder')}
                      />
                    </div>

                    {/* Password Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="password" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                        {t('auth.login.passwordLabel')}
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder={t('auth.login.passwordPlaceholder')}
                      />
                      <div className="flex justify-end">
                        <Link to="/forgot-password" className="text-[14px] font-semibold text-[#1d1d1f] hover:underline tracking-[0.075px]">
                          {t('auth.login.forgotPassword')}
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* WhatsApp Number Field — identifies the account */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="whatsapp_phone" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                        {t('auth.login.whatsappLabel')}<span className="text-red-500">*</span>
                      </label>
                      <input
                        id="whatsapp_phone"
                        name="whatsapp_phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        disabled={codeSent}
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder="+387 61 123 456"
                      />
                      <p className="text-[13px] text-[rgba(29,29,31,0.6)]">
                        {t('auth.login.whatsappHint')}
                      </p>
                    </div>

                    {/* Sign-in Code Field */}
                    {codeSent && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="signin_code" className="text-[15px] font-semibold text-[#1d1d1f] leading-5 tracking-[0.075px]">
                          {t('auth.login.codeLabel')}<span className="text-red-500">*</span>
                        </label>
                        <input
                          id="signin_code"
                          name="signin_code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          maxLength={6}
                          value={signInCode}
                          onChange={(e) => setSignInCode(e.target.value.replace(/\D/g, ''))}
                          className={`${INPUT_CLASS} tracking-[0.4em]`}
                          placeholder="123456"
                        />
                        <div className="flex justify-between">
                          <button
                            type="button"
                            onClick={useDifferentNumber}
                            className="text-[14px] font-semibold text-[#1d1d1f] hover:underline tracking-[0.075px]"
                          >
                            {t('auth.login.changeNumber')}
                          </button>
                          <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={resendTimer > 0 || loading}
                            className="text-[14px] font-semibold text-[#1d1d1f] hover:underline tracking-[0.075px] disabled:text-[rgba(29,29,31,0.4)] disabled:no-underline"
                          >
                            {resendTimer > 0
                              ? t('auth.login.resendIn', { seconds: resendTimer })
                              : t('auth.login.resendCode')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] bg-[#212121] text-white text-[16px] font-semibold rounded-full hover:bg-[#212121]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-50 transition-colors tracking-[0.08px] leading-5"
              >
                {submitLabel}
              </button>

              {/* Sign Up Link */}
              <p className="text-center text-[15px] text-[rgba(0,0,0,0.8)] leading-5">
                {t('auth.login.noAccount')}{' '}
                <Link to="/register" className="font-semibold tracking-[0.075px] hover:underline">
                  {t('auth.login.signUp')}
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
