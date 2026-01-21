import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '@/services/api';
import watchsphereLogo from '@/assets/watchsphere-logo-full.svg';

const CODE_LENGTH = 6;

export function VerifyResetCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  const handleCodeChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Move to next input if digit entered
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);

    if (pastedData) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);

      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();

      // Auto-submit if complete
      if (pastedData.length === CODE_LENGTH) {
        handleVerifyCode(pastedData);
      }
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete verification code');
      return;
    }

    setLoading(true);
    setError('');

    // Navigate to new password screen with email and code
    navigate('/reset-password', { state: { email, code: fullCode } });
    setLoading(false);
  };

  const handleResendCode = async () => {
    setResending(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      // Show success message (could use a toast here)
    } catch (err: any) {
      // Still show success for security
    } finally {
      setResending(false);
    }
  };

  const canSubmit = code.every((digit) => digit !== '');

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col relative">
        {/* Logo */}
        <div className="absolute top-5 left-10">
          <img src={watchsphereLogo} alt="WatchSphere" className="h-[22px]" />
        </div>

        {/* Back Button */}
        <div className="absolute top-5 left-10 mt-12">
          <button
            onClick={() => navigate('/forgot-password')}
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
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-full max-w-[450px] flex flex-col gap-8">
            {/* Header */}
            <div>
              <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal mb-2">
                Enter verification code
              </h1>
              <p className="text-[17px] text-[rgba(29,29,31,0.6)] leading-[22px] tracking-[-0.43px]">
                We've sent a 6-digit code to{' '}
                <span className="font-semibold text-[#1d1d1f]">{email}</span>
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Code Input */}
            <div className="flex gap-2 justify-between">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className={`w-14 h-14 text-center text-2xl font-semibold border rounded-xl focus:outline-none transition-colors ${
                    digit
                      ? 'bg-[rgba(29,29,31,0.03)] border-[rgba(29,29,31,0.1)]'
                      : 'bg-white border-[rgba(29,29,31,0.1)]'
                  } focus:border-2 focus:border-[#1d1d1f]`}
                />
              ))}
            </div>

            {/* Resend Code */}
            <div className="text-center">
              <span className="text-[14px] text-[rgba(29,29,31,0.6)]">
                Didn't receive the code?{' '}
              </span>
              <button
                onClick={handleResendCode}
                disabled={resending}
                className="text-[14px] font-semibold text-[#1d1d1f] hover:underline disabled:text-[rgba(29,29,31,0.4)]"
              >
                {resending ? 'Sending...' : 'Resend'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => handleVerifyCode()}
              disabled={!canSubmit || loading}
              className="w-full h-[44px] bg-[#1d1d1f] text-white text-[16px] font-semibold rounded-full hover:bg-[#1d1d1f]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1d1d1f] disabled:bg-[rgba(33,33,33,0.05)] disabled:text-[rgba(29,29,31,0.4)] transition-colors tracking-[0.08px] leading-5"
            >
              {loading ? 'Verifying...' : 'Continue'}
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
