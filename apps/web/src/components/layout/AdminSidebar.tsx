import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Watch,
  Newspaper,
  Heart,
  MessageSquare,
  Bot,
  Upload,
  Activity,
  CreditCard,
  Eye,
  Settings,
  ChevronDown,
  Store,
  MessageCircle
} from 'lucide-react'

interface NavItem {
  name: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const adminNavigation: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { name: 'Overview', to: '/admin', icon: LayoutDashboard },
    ]
  },
  {
    title: 'User Management',
    items: [
      { name: 'All Users', to: '/admin/users', icon: Users },
      { name: 'Pending Approval', to: '/admin/users/pending', icon: UserCheck },
    ]
  },
  {
    title: 'Content',
    items: [
      { name: 'Market (Watches)', to: '/admin/watches', icon: Watch },
      { name: 'News', to: '/admin/news', icon: Newspaper },
      { name: 'Watchlist Records', to: '/admin/watchlist', icon: Heart },
    ]
  },
  {
    title: 'Communication',
    items: [
      { name: 'Chat Groups', to: '/admin/chat-groups', icon: MessageSquare },
      { name: 'AI Chat Insights', to: '/admin/ai-insights', icon: Bot },
    ]
  },
  {
    title: 'Data & Analytics',
    items: [
      { name: 'WhatsApp Import', to: '/admin/whatsapp', icon: Upload },
      { name: 'Activity Log', to: '/admin/activity', icon: Activity },
      { name: 'Billing', to: '/admin/billing', icon: CreditCard },
    ]
  },
  {
    title: 'Preview',
    items: [
      { name: 'User Home', to: '/app', icon: Eye },
      { name: 'User Market', to: '/app/market', icon: Store },
      { name: 'User Chat', to: '/app/chat', icon: MessageCircle },
    ]
  },
]

export function AdminSidebar() {
  const [expandedSections, setExpandedSections] = useState<string[]>(
    adminNavigation.map(s => s.title)
  )

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    )
  }

  return (
    <aside className="w-64 bg-white border-r flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <h1 className="text-xl font-bold text-primary">WatchSphere</h1>
        <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {adminNavigation.map((section) => (
          <div key={section.title} className="mb-2">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50"
            >
              {section.title}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  expandedSections.includes(section.title) ? '' : '-rotate-90'
                }`}
              />
            </button>

            {expandedSections.includes(section.title) && (
              <div className="mt-1 space-y-1 px-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t p-4">
        <NavLink
          to="/admin/settings"
          className={({ isActive }) =>
            `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Settings className="w-5 h-5 mr-3" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
