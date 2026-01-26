import { Bell, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@watchsphere/shared/stores'

export function AdminHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b h-16 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {t('admin.header.title')}
        </h2>
        <p className="text-sm text-gray-500">{t('admin.header.subtitle')}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={t('header.logout')}
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  )
}
