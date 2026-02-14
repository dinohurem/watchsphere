import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useV2 } from '@/contexts/V2Context'

export function AdminSettings() {
  const [v2Enabled, setV2Enabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { refetch: refetchV2 } = useV2()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/app')
      setV2Enabled(response.data.v2_enabled ?? false)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleV2 = async () => {
    const newValue = !v2Enabled
    setSaving(true)
    try {
      await api.patch('/settings/app', { v2_enabled: newValue })
      setV2Enabled(newValue)
      // Update the global V2 context so all consumers reflect the change immediately
      await refetchV2()
    } catch (error) {
      console.error('Failed to update settings:', error)
    } finally {
      setSaving(false)
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure platform settings</p>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">V2 Features</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable V2 Features</h3>
              <p className="text-sm text-gray-500 mt-1">
                Chat, Inventory, Orders, Social Search, and more
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleV2}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
                v2Enabled ? 'bg-primary' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={v2Enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  v2Enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
