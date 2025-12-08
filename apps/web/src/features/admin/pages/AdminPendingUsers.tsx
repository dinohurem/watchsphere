import { useEffect, useState } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { api } from '@/services/api'

interface User {
  id: string
  email: string
  name: string
  role: 'dealer' | 'collector' | 'admin'
  verified: boolean
  approved: boolean
  is_active: boolean
  created_at: string
}

function RoleBadge({ role }: { role: string }) {
  const colors = {
    admin: 'bg-purple-100 text-purple-800',
    dealer: 'bg-blue-100 text-blue-800',
    collector: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {role}
    </span>
  )
}

export function AdminPendingUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  const fetchPendingUsers = async () => {
    try {
      const response = await api.get('/admin/users/pending')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch pending users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string) => {
    setProcessingId(userId)
    try {
      await api.post(`/admin/users/${userId}/approve`)
      fetchPendingUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (userId: string) => {
    if (!confirm('Are you sure you want to reject this user? They will be deactivated.')) return
    setProcessingId(userId)
    try {
      await api.post(`/admin/users/${userId}/reject`)
      fetchPendingUsers()
    } catch (error) {
      console.error('Failed to reject user:', error)
    } finally {
      setProcessingId(null)
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
        <h1 className="text-2xl font-bold text-gray-900">Pending Approval</h1>
        <p className="text-gray-600">Review and approve new user registrations ({users.length} pending)</p>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals</h3>
          <p className="text-gray-500">All user registrations have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <span className="text-amber-600 text-lg font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                      <RoleBadge role={user.role} />
                    </div>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Registered {new Date(user.created_at).toLocaleDateString()} at {new Date(user.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReject(user.id)}
                    disabled={processingId === user.id}
                    className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={processingId === user.id}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {processingId === user.id ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
