import { NavLink } from 'react-router-dom'
import {
  Home,
  Store,
  Heart,
  MessageSquare,
  User
} from 'lucide-react'

const navigation = [
  { name: 'Home', to: '/', icon: Home },
  { name: 'Market', to: '/market', icon: Store },
  { name: 'My Watchlist', to: '/watchlist', icon: Heart },
  { name: 'Chat', to: '/chat', icon: MessageSquare },
  { name: 'Profile', to: '/profile', icon: User },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white border-r">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b">
          <h1 className="text-xl font-bold text-primary">WatchSphere</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
