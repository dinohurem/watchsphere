import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { UserLayout } from './components/layout/UserLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { OnboardingPage } from './features/auth/pages/OnboardingPage'
import { AuthHandoffPage } from './features/auth/pages/AuthHandoffPage'
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage'
import { VerifyResetCodePage } from './features/auth/pages/VerifyResetCodePage'
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'
import { AdminRoute } from './features/auth/components/AdminRoute'
import { HomePage } from './features/home/pages/HomePage'
import { MarketPage } from './features/market/pages/MarketPage'
import { FiltersPage } from './features/market/pages/FiltersPage'
import { WatchDetailsPage } from './features/market/pages/WatchDetailsPage'
import { OrderDetailPage } from './features/market/pages/OrderDetailPage'
import { WatchlistPage } from './features/watchlist/pages/WatchlistPage'
import { ChatPage } from './features/chat/pages/ChatPage'
import { AIChatPage } from './features/chat/pages/AIChatPage'
import { UserProfilePage } from './features/profile/pages/UserProfilePage'
import { ProfileSettingsPage } from './features/profile/pages/ProfileSettingsPage'
import { PaymentCallbackPage } from './features/payment/pages/PaymentCallbackPage'
import { SocialSearchPage } from './features/social/pages/SocialSearchPage'
import { SocialFiltersPage } from './features/social/pages/SocialFiltersPage'
import { NewsDetailsPage } from './features/news/pages/NewsDetailsPage'
import { InventoryPage } from './features/inventory/pages/InventoryPage'
import { CreateListingPage } from './features/inventory/pages/CreateListingPage'
import { SearchPage } from './features/search/pages/SearchPage'
import { LandingPage } from './features/landing/pages/LandingPage'
import { NotificationsPage } from './features/notifications/pages/NotificationsPage'
import { useAuthStore } from '@watchsphere/shared/stores'
import { api } from './services/api'

// Admin pages
import {
  AdminDashboard,
  AdminUsers,
  AdminPendingUsers,
  AdminWatches,
  AdminNews,
  AdminWatchlist,
  AdminChatGroups,
  AdminAIInsights,
  AdminWhatsAppImport,
  AdminActivity,
  AdminBilling,
  AdminSettings,
  AdminListingFields,
  AdminFilters,
  AdminSupport
} from './features/admin/pages'

// Legal pages
import { PrivacyPolicyPage, TermsConditionsPage, ContactPage } from './features/legal/pages'

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
      <Route path="/terms-conditions" element={<TermsConditionsPage />} />
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
        <Route path="user/:userId" element={<UserProfilePage />} />
        <Route path="news/:newsId" element={<NewsDetailsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  )
}

export default App
