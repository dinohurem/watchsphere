import { Routes, Route } from 'react-router-dom'
import { UserLayout } from './components/layout/UserLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { OnboardingPage } from './features/auth/pages/OnboardingPage'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'
import { AdminRoute } from './features/auth/components/AdminRoute'
import { HomePage } from './features/home/pages/HomePage'
import { MarketPage } from './features/market/pages/MarketPage'
import { WatchlistPage } from './features/watchlist/pages/WatchlistPage'
import { ChatPage } from './features/chat/pages/ChatPage'
import { ProfilePage } from './features/profile/pages/ProfilePage'
import { LandingPage } from './features/landing/pages/LandingPage'

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
  AdminSettings
} from './features/admin/pages'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

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
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}

export default App
