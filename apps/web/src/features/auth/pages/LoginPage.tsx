import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import { useGoogleLogin } from '@react-oauth/google';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Handle OAuth response
  const handleOAuthSuccess = async (user: any, access_token: string, refresh_token: string, isNewUser: boolean) => {
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    login(user, access_token);

    if (user.role === 'admin') {
      navigate('/admin');
    } else if (isNewUser) {
      navigate('/onboarding');
    } else {
      navigate('/app');
    }
  };

  // Google Login handler
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        // Send access token to backend
        const response = await api.post('/auth/google', {
          access_token: tokenResponse.access_token,
        });

        const { user, access_token, refresh_token, is_new_user } = response.data;
        await handleOAuthSuccess(user, access_token, refresh_token, is_new_user);
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || 'Google login failed. Please try again.';
        setError(errorDetail);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError('Google login failed. Please try again.');
    },
    flow: 'implicit',
  });

  // Apple Login handler
  const handleAppleLogin = async () => {
    setAppleLoading(true);
    setError('');
    try {
      // Apple Sign In requires the AppleID JS library
      // @ts-ignore - AppleID is loaded from script
      const response = await window.AppleID?.auth.signIn();

      if (response?.authorization?.id_token) {
        const apiResponse = await api.post('/auth/apple', {
          id_token: response.authorization.id_token,
          user_name: response.user?.name
            ? `${response.user.name.firstName || ''} ${response.user.name.lastName || ''}`.trim()
            : undefined,
        });

        const { user, access_token, refresh_token, is_new_user } = apiResponse.data;
        await handleOAuthSuccess(user, access_token, refresh_token, is_new_user);
      }
    } catch (err: any) {
      if (err?.error !== 'popup_closed_by_user') {
        const errorDetail = err.response?.data?.detail || 'Apple login failed. Please try again.';
        setError(errorDetail);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // Initialize Apple Sign In
  useEffect(() => {
    // Load Apple Sign In JS
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.AppleID?.auth.init({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { user, access_token, refresh_token } = response.data;

      // Store tokens
      localStorage.setItem('auth_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      login(user, access_token);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || 'Login failed. Please try again.';

      if (errorDetail.toLowerCase().includes('pending approval')) {
        setError('Your account is pending approval. Please wait for an administrator to approve your account.');
      } else {
        setError(errorDetail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col">
        {/* Logo */}
        <div className="p-5">
          <img src="/images/logo.svg" alt="WatchSphere" className="h-10" />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-[450px] space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F] tracking-wide">
                Log in
              </h1>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-[15px] font-semibold text-[#1D1D1F]">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                    placeholder="Please enter e-mail address"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-[15px] font-semibold text-[#1D1D1F]">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 border border-[#1D1D1F]/10 rounded-2xl text-[15px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 focus:border-[#1D1D1F]/20"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D1D1F] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Logging in...' : 'Log In'}
              </button>

              {/* Sign Up Link */}
              <p className="text-center text-[15px] text-black/80">
                Don't have an account?{' '}
                <Link to="/register" className="font-medium hover:underline">
                  Sign up
                </Link>
              </p>
            </form>

            {/* Divider */}
            <div className="text-center">
              <span className="text-[18px] text-black/60">OR</span>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={appleLoading || googleLoading || loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-[#1D1D1F]/10 rounded-2xl text-[16px] font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
                {appleLoading ? 'Signing in...' : 'Continue with Apple'}
              </button>

              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={googleLoading || appleLoading || loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-[#1D1D1F]/10 rounded-2xl text-[16px] font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="p-8 flex items-center justify-center gap-8">
          <Link to="/privacy" className="text-[14px] font-medium text-[#1D1D1F]/70 hover:text-[#1D1D1F]">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-[14px] font-medium text-[#1D1D1F]/70 hover:text-[#1D1D1F]">
            Terms and Conditions
          </Link>
          <Link to="/contact" className="text-[14px] font-medium text-[#1D1D1F]/70 hover:text-[#1D1D1F]">
            Contact
          </Link>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block w-[641px] p-[90px] pr-10">
        <div
          className="w-full h-full rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/auth-background.png)' }}
        />
      </div>
    </div>
  );
}
