import { Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'
import { HomePage } from './features/home/pages/HomePage'
import { MarketPage } from './features/market/pages/MarketPage'
import { WatchlistPage } from './features/watchlist/pages/WatchlistPage'
import { ChatPage } from './features/chat/pages/ChatPage'
import { ProfilePage } from './features/profile/pages/ProfilePage'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
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
