import { Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'

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
        <Route index element={<div className="p-8">Home Page - Coming Soon</div>} />
        <Route path="market" element={<div className="p-8">Market Page - Coming Soon</div>} />
        <Route path="dashboard" element={<div className="p-8">Dashboard Page - Coming Soon</div>} />
        <Route path="chat" element={<div className="p-8">Chat Page - Coming Soon</div>} />
        <Route path="profile" element={<div className="p-8">Profile Page - Coming Soon</div>} />
      </Route>
    </Routes>
  )
}

export default App
