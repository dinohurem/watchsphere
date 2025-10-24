import { Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'

// Import your feature pages here as you create them
// import { HomePage } from './features/home/pages/HomePage'
// import { MarketPage } from './features/market/pages/MarketPage'
// import { DashboardPage } from './features/dashboard/pages/DashboardPage'
// import { ChatPage } from './features/chat/pages/ChatPage'
// import { ProfilePage } from './features/profile/pages/ProfilePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
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
