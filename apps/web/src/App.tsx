import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { UserLayout } from './components/layout/UserLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'
import { AdminRoute } from './features/auth/components/AdminRoute'
import { PageLoader } from './components/ui/PageLoader'
import { useAuthStore } from '@watchsphere/shared/stores'
import { api } from './services/api'
import { V2Provider } from './contexts/V2Context'

// --- Lazy-loaded page components ---

// Auth pages
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./features/auth/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const OnboardingPage = lazy(() => import('./features/auth/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const AuthHandoffPage = lazy(() => import('./features/auth/pages/AuthHandoffPage').then(m => ({ default: m.AuthHandoffPage })))
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const VerifyResetCodePage = lazy(() => import('./features/auth/pages/VerifyResetCodePage').then(m => ({ default: m.VerifyResetCodePage })))
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))

// User pages
const HomePage = lazy(() => import('./features/home/pages/HomePage').then(m => ({ default: m.HomePage })))
const MarketPage = lazy(() => import('./features/market/pages/MarketPage').then(m => ({ default: m.MarketPage })))
const FiltersPage = lazy(() => import('./features/market/pages/FiltersPage').then(m => ({ default: m.FiltersPage })))
const WatchDetailsPage = lazy(() => import('./features/market/pages/WatchDetailsPage').then(m => ({ default: m.WatchDetailsPage })))
const OrderDetailPage = lazy(() => import('./features/market/pages/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })))
const WatchlistPage = lazy(() => import('./features/watchlist/pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })))
const ChatPage = lazy(() => import('./features/chat/pages/ChatPage').then(m => ({ default: m.ChatPage })))
const AIChatPage = lazy(() => import('./features/chat/pages/AIChatPage').then(m => ({ default: m.AIChatPage })))
const UserProfilePage = lazy(() => import('./features/profile/pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })))
const ProfileSettingsPage = lazy(() => import('./features/profile/pages/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })))
const PaymentCallbackPage = lazy(() => import('./features/payment/pages/PaymentCallbackPage').then(m => ({ default: m.PaymentCallbackPage })))
const SocialSearchPage = lazy(() => import('./features/social/pages/SocialSearchPage').then(m => ({ default: m.SocialSearchPage })))
const SocialFiltersPage = lazy(() => import('./features/social/pages/SocialFiltersPage').then(m => ({ default: m.SocialFiltersPage })))
const NewsDetailsPage = lazy(() => import('./features/news/pages/NewsDetailsPage').then(m => ({ default: m.NewsDetailsPage })))
const InventoryPage = lazy(() => import('./features/inventory/pages/InventoryPage').then(m => ({ default: m.InventoryPage })))
const CreateListingPage = lazy(() => import('./features/inventory/pages/CreateListingPage').then(m => ({ default: m.CreateListingPage })))
const SearchPage = lazy(() => import('./features/search/pages/SearchPage').then(m => ({ default: m.SearchPage })))
const LandingPage = lazy(() => import('./features/landing/pages/LandingPage').then(m => ({ default: m.LandingPage })))
const NotificationsPage = lazy(() => import('./features/notifications/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))

// Admin pages (each lazy-loaded individually instead of barrel import)
const AdminDashboard = lazy(() => import('./features/admin/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminUsers = lazy(() => import('./features/admin/pages/AdminUsers').then(m => ({ default: m.AdminUsers })))
const AdminPendingUsers = lazy(() => import('./features/admin/pages/AdminPendingUsers').then(m => ({ default: m.AdminPendingUsers })))
const AdminWatches = lazy(() => import('./features/admin/pages/AdminWatches').then(m => ({ default: m.AdminWatches })))
const AdminNews = lazy(() => import('./features/admin/pages/AdminNews').then(m => ({ default: m.AdminNews })))
const AdminWatchlist = lazy(() => import('./features/admin/pages/AdminWatchlist').then(m => ({ default: m.AdminWatchlist })))
const AdminChatGroups = lazy(() => import('./features/admin/pages/AdminChatGroups').then(m => ({ default: m.AdminChatGroups })))
const AdminAIInsights = lazy(() => import('./features/admin/pages/AdminAIInsights').then(m => ({ default: m.AdminAIInsights })))
const AdminWhatsAppImport = lazy(() => import('./features/admin/pages/AdminWhatsAppImport').then(m => ({ default: m.AdminWhatsAppImport })))
const AdminActivity = lazy(() => import('./features/admin/pages/AdminActivity').then(m => ({ default: m.AdminActivity })))
const AdminBilling = lazy(() => import('./features/admin/pages/AdminBilling').then(m => ({ default: m.AdminBilling })))
const AdminSettings = lazy(() => import('./features/admin/pages/AdminSettings').then(m => ({ default: m.AdminSettings })))
const AdminListingFields = lazy(() => import('./features/admin/pages/AdminListingFields').then(m => ({ default: m.AdminListingFields })))
const AdminFilters = lazy(() => import('./features/admin/pages/AdminFilters').then(m => ({ default: m.AdminFilters })))
const AdminSupport = lazy(() => import('./features/admin/pages/AdminSupport').then(m => ({ default: m.AdminSupport })))

// Legal pages
const PrivacyPolicyPage = lazy(() => import('./features/legal/pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })))
const TermsConditionsPage = lazy(() => import('./features/legal/pages/TermsConditionsPage').then(m => ({ default: m.TermsConditionsPage })))
const ContactPage = lazy(() => import('./features/legal/pages/ContactPage').then(m => ({ default: m.ContactPage })))

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const login = useAuthStore((state) => state.login)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  // Try to restore session from stored tokens on app startup
  useEffect(() => {
    const restoreSession = async () => {
      if (!hasHydrated) return

      // If already authenticated from zustand persist, we're done
      if (isAuthenticated) {
        setIsRestoringSession(false)
        return
      }

      try {
        // Check if we have a stored token
        const token = localStorage.getItem('auth_token')
        const refreshToken = localStorage.getItem('refresh_token')

        if (token) {
          // Try to get current user with the stored token
          try {
            const response = await api.get('/auth/me')
            if (response.data) {
              // Restore the session
              login(response.data, token)
              setIsRestoringSession(false)
              return
            }
          } catch (error: any) {
            // Token might be expired, try refresh if we have refresh token
            if (refreshToken && error.response?.status === 401) {
              try {
                const refreshResponse = await api.post('/auth/refresh', {
                  refresh_token: refreshToken,
                })
                const { user, access_token, refresh_token: newRefreshToken } = refreshResponse.data

                localStorage.setItem('auth_token', access_token)
                localStorage.setItem('refresh_token', newRefreshToken)

                login(user, access_token)
                setIsRestoringSession(false)
                return
              } catch (refreshError) {
                // Refresh failed, clear tokens
                localStorage.removeItem('auth_token')
                localStorage.removeItem('refresh_token')
              }
            }
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error)
      }

      setIsRestoringSession(false)
    }

    restoreSession()
  }, [hasHydrated, isAuthenticated, login])

  // Show loading while hydrating or restoring session
  if (!hasHydrated || isRestoringSession) {
    return null
  }
  return (
    <V2Provider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-reset-code" element={<VerifyResetCodePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
        <Route path="/terms-conditions" element={<TermsConditionsPage />} />
        <Route path="/terms" element={<Navigate to="/terms-conditions" replace />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/payment-callback" element={<PaymentCallbackPage />} />
        <Route path="/auth/handoff" element={<AuthHandoffPage />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/pending" element={<AdminPendingUsers />} />
          <Route path="watches" element={<AdminWatches />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="watchlist" element={<AdminWatchlist />} />
          <Route path="chat-groups" element={<AdminChatGroups />} />
          <Route path="ai-insights" element={<AdminAIInsights />} />
          <Route path="whatsapp" element={<AdminWhatsAppImport />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="listing-fields" element={<AdminListingFields />} />
          <Route path="filters" element={<AdminFilters />} />
          <Route path="support" element={<AdminSupport />} />
        </Route>

        {/* Protected user routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="market" element={<MarketPage />} />
          <Route path="market/filters" element={<FiltersPage />} />
          <Route path="watch/:watchId" element={<WatchDetailsPage />} />
          <Route path="order/:orderId" element={<OrderDetailPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:recipientId" element={<ChatPage />} />
          <Route path="ai-assistant" element={<AIChatPage />} />
          <Route path="social-search" element={<SocialSearchPage />} />
          <Route path="social-search/filters" element={<SocialFiltersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/create" element={<CreateListingPage />} />
          <Route path="inventory/edit/:orderId" element={<CreateListingPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="profile/settings" element={<ProfileSettingsPage />} />
          <Route path="profile/billing" element={<ProfileSettingsPage />} />
          <Route path="profile/orders" element={<ProfileSettingsPage />} />
          <Route path="user/:userId" element={<UserProfilePage />} />
          <Route path="news/:newsId" element={<NewsDetailsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>
    </Suspense>
    </V2Provider>
  )
}

export default App
