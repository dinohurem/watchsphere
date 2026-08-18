import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  Watch,
  Newspaper,
  Heart,
  MessageSquare,
  Bot,
  Upload,
  Activity,
  CreditCard,
  Eye,
  ChevronDown,
  Store,
  MessageCircle,
  ExternalLink,
  List,
  SlidersHorizontal,
  Headphones,
  Settings,
  FileOutput,
  Radio,
} from 'lucide-react'

interface NavItem {
  nameKey: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  titleKey: string
  items: NavItem[]
}

const adminNavigationConfig: NavSection[] = [
  {
    titleKey: 'sidebar.dashboard',
    items: [
      { nameKey: 'sidebar.dashboard', to: '/admin', icon: LayoutDashboard },
    ]
  },
  {
    titleKey: 'sidebar.userManagement',
    items: [
      { nameKey: 'sidebar.users', to: '/admin/users', icon: Users },
    ]
  },
  {
    titleKey: 'sidebar.content',
    items: [
      { nameKey: 'sidebar.watches', to: '/admin/watches', icon: Watch },
      { nameKey: 'sidebar.news', to: '/admin/news', icon: Newspaper },
      { nameKey: 'sidebar.watchlist', to: '/admin/watchlist', icon: Heart },
      { nameKey: 'sidebar.listingFields', to: '/admin/listing-fields', icon: List },
      { nameKey: 'sidebar.filters', to: '/admin/filters', icon: SlidersHorizontal },
    ]
  },
  {
    titleKey: 'sidebar.communication',
    items: [
      { nameKey: 'sidebar.chatGroups', to: '/admin/chat-groups', icon: MessageSquare },
      { nameKey: 'sidebar.aiInsights', to: '/admin/ai-insights', icon: Bot },
    ]
  },
  {
    titleKey: 'sidebar.dataAnalytics',
    items: [
      { nameKey: 'sidebar.wtbWtsGenerator', to: '/admin/wtb-wts', icon: FileOutput },
      { nameKey: 'sidebar.whatsappImport', to: '/admin/whatsapp', icon: Upload },
      { nameKey: 'sidebar.whatsappBridge', to: '/admin/whatsapp-bridge', icon: Radio },
      { nameKey: 'sidebar.activity', to: '/admin/activity', icon: Activity },
      { nameKey: 'sidebar.billing', to: '/admin/billing', icon: CreditCard },
    ]
  },
  {
    titleKey: 'sidebar.supportSection',
    items: [
      { nameKey: 'sidebar.support', to: '/admin/support', icon: Headphones },
    ]
  },
  {
    titleKey: 'sidebar.settingsSection',
    items: [
      { nameKey: 'sidebar.settings', to: '/admin/settings', icon: Settings },
    ]
  },
]

// Preview links for viewing as user
const previewLinksConfig = [
  { nameKey: 'sidebar.home', to: '/app', icon: Eye },
  { nameKey: 'sidebar.market', to: '/app/market', icon: Store },
  { nameKey: 'sidebar.chat', to: '/app/chat', icon: MessageCircle },
]

export function AdminSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [expandedSections, setExpandedSections] = useState<string[]>(
    adminNavigationConfig.map(s => s.titleKey)
  )
  const [showPreviewMenu, setShowPreviewMenu] = useState(false)

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
        {adminNavigationConfig.map((section) => (
          <div key={section.titleKey} className="mb-2">
            <button
              onClick={() => toggleSection(section.titleKey)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50"
            >
              {t(`admin.${section.titleKey}`)}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  expandedSections.includes(section.titleKey) ? '' : '-rotate-90'
                }`}
              />
            </button>

            {expandedSections.includes(section.titleKey) && (
              <div className="mt-1 space-y-1 px-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.nameKey}
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
                    {t(`admin.${item.nameKey}`)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* View as User Section */}
      <div className="border-t p-4">
        <div className="relative">
          <button
            onClick={() => setShowPreviewMenu(!showPreviewMenu)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <div className="flex items-center">
              <Eye className="w-5 h-5 mr-3" />
              {t('admin.sidebar.backToApp')}
            </div>
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Preview dropdown menu */}
          {showPreviewMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b">
                <p className="text-xs font-medium text-gray-500 uppercase">{t('admin.sidebar.previewPages')}</p>
              </div>
              {previewLinksConfig.map((link) => (
                <button
                  key={link.nameKey}
                  onClick={() => {
                    setShowPreviewMenu(false)
                    navigate(link.to)
                  }}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <link.icon className="w-4 h-4 mr-3 text-gray-500" />
                  {t(`admin.${link.nameKey}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </aside>
  )
}
