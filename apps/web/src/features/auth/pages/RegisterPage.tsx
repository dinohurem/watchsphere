import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';

export function RegisterPage() {
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
        setError(detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex bg-white">
        {/* Left Side */}
        <div className="flex-1 flex flex-col">
          {/* Logo */}
          <div className="p-5">
            <img src="/images/logo.svg" alt="WatchSphere" className="h-10" />
          </div>

          {/* Success Message */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="w-full max-w-[450px] space-y-8 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-[32px] font-bold text-[#1D1D1F]">
                Account Created!
              </h1>
              <p className="text-[15px] text-black/60">
                Your account has been created successfully. Please wait for an administrator to approve your account before you can log in.
              </p>
              <Link
                to="/login"
                className="inline-block w-full py-3.5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl hover:bg-[#1D1D1F]/90 transition-colors"
              >
                Go to Login
              </Link>
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
                Sign Up
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
                    autoComplete="new-password"
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
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>

              {/* Login Link */}
              <p className="text-center text-[15px] text-black/80">
                Already have an account?{' '}
                <Link to="/login" className="font-medium hover:underline">
                  Log in now
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
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-[#1D1D1F]/10 rounded-2xl text-[16px] font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                </svg>
                Continue with Apple
              </button>

              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-[#1D1D1F]/10 rounded-2xl text-[16px] font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
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
