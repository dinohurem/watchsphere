import { NavLink } from 'react-router-dom'
import {
  Home,
  Store,
  Heart,
  MessageSquare,
  User,
  Sparkles
} from 'lucide-react'
import { useChatStore } from '@watchsphere/shared/stores'

const navigation = [
  { name: 'Home', to: '/app', icon: Home },
  { name: 'Market', to: '/app/market', icon: Store },
  { name: 'My Watchlist', to: '/app/watchlist', icon: Heart },
  { name: 'Chat', to: '/app/chat', icon: MessageSquare, showUnreadBadge: true },
  { name: 'AI Assistant', to: '/app/ai-assistant', icon: Sparkles },
  { name: 'Profile', to: '/app/profile', icon: User },
]

export function Sidebar() {
  const totalUnread = useChatStore((state) => state.totalUnread)

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
              <div className="relative">
                <item.icon className="w-5 h-5 mr-3" />
                {item.showUnreadBadge && totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              {item.name}
              {item.showUnreadBadge && totalUnread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
