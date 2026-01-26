import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Watch, Activity } from 'lucide-react'
import { api } from '@/services/api'

interface DashboardStats {
  total_users: number
  total_dealers: number
  total_collectors: number
  total_admins: number
  verified_users: number
  active_users: number
  pending_approval: number
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default'
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'warning' | 'success'
}) {
  const variants = {
    default: 'bg-white',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200'
  }

  return (
    <div className={`${variants[variant]} rounded-lg border p-6 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 bg-gray-100 rounded-full">
          <Icon className="w-6 h-6 text-gray-600" />
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard.title')}</h1>
        <p className="text-gray-600">{t('admin.dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title={t('admin.dashboard.totalUsers')}
          value={stats?.total_users || 0}
          icon={Users}
        />
        <StatCard
          title={t('admin.dashboard.dealers')}
          value={stats?.total_dealers || 0}
          icon={Watch}
        />
        <StatCard
          title={t('admin.dashboard.collectors')}
          value={stats?.total_collectors || 0}
          icon={Users}
        />
        <StatCard
          title={t('admin.dashboard.pendingApproval')}
          value={stats?.pending_approval || 0}
          icon={Activity}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.recentActivity')}</h2>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-sm">{t('admin.dashboard.activityPlaceholder')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.quickActions')}</h2>
          </div>
          <div className="p-4 space-y-2">
            <Link
              to="/admin/users/pending"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {t('admin.dashboard.viewPendingApprovals')} ({stats?.pending_approval || 0})
            </Link>
            <Link
              to="/admin/news"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {t('admin.dashboard.createNewsArticle')}
            </Link>
            <Link
              to="/admin/whatsapp"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {t('admin.dashboard.importWhatsApp')}
            </Link>
            <Link
              to="/admin/users"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {t('admin.dashboard.manageAllUsers')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
