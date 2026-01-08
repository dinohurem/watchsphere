import { useEffect, useState } from 'react'
import { Search, Check, X, Trash2, UserPlus, Mail } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

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

interface InviteFormData {
  email: string
  name: string
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

function StatusBadge({ active, approved }: { active: boolean; approved: boolean }) {
  if (!approved) {
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Pending</span>
  }
  if (!active) {
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Inactive</span>
  }
  return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteFormData, setInviteFormData] = useState<InviteFormData>({ email: '', name: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [reinviting, setReinviting] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/approve`)
      fetchUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
    }
    setActionMenuOpen(null)
  }

  const handleReject = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/reject`)
      fetchUsers()
    } catch (error) {
      console.error('Failed to reject user:', error)
    }
    setActionMenuOpen(null)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await api.delete(`/admin/users/${userId}`)
      fetchUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
    setActionMenuOpen(null)
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !currentStatus })
      fetchUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
    setActionMenuOpen(null)
  }

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      await api.post('/admin/invite-admin', inviteFormData)
      setInviteSuccess(`Invitation sent to ${inviteFormData.email}`)
      setInviteFormData({ email: '', name: '' })
      fetchUsers()
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteSuccess(null)
      }, 2000)
    } catch (error: any) {
      setInviteError(error.response?.data?.detail || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleReinvite = async (user: User) => {
    setReinviting(user.id)
    setActionMenuOpen(null)

    try {
      await api.post('/admin/reinvite-admin', { email: user.email })
      alert(`Re-invitation sent to ${user.email}`)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to send re-invitation')
    } finally {
      setReinviting(null)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage all registered users ({users.length} total)</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            <option value="all">All Roles</option>
            <option value="dealer">Dealers</option>
            <option value="collector">Collectors</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge active={user.is_active} approved={user.approved} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ActionMenu
                      isOpen={actionMenuOpen === user.id}
                      onToggle={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                      onClose={() => setActionMenuOpen(null)}
                    >
                      {!user.approved && user.role !== 'admin' && (
                        <ActionMenuItem
                          onClick={() => handleApprove(user.id)}
                          variant="success"
                          icon={<Check className="w-4 h-4" />}
                        >
                          Approve
                        </ActionMenuItem>
                      )}
                      {!user.approved && user.role !== 'admin' && (
                        <ActionMenuItem
                          onClick={() => handleReject(user.id)}
                          icon={<X className="w-4 h-4" />}
                        >
                          Reject
                        </ActionMenuItem>
                      )}
                      {user.role === 'admin' && (
                        <ActionMenuItem
                          onClick={() => handleReinvite(user)}
                          icon={<Mail className="w-4 h-4" />}
                          disabled={reinviting === user.id}
                        >
                          {reinviting === user.id ? 'Sending...' : 'Re-invite'}
                        </ActionMenuItem>
                      )}
                      <ActionMenuItem onClick={() => handleToggleActive(user.id, user.is_active)}>
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </ActionMenuItem>
                      {user.role !== 'admin' && (
                        <ActionMenuItem
                          onClick={() => handleDelete(user.id)}
                          variant="danger"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Delete
                        </ActionMenuItem>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No users found matching your criteria
          </div>
        )}
      </div>

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Invite User</h2>
              <p className="text-sm text-gray-500 mt-1">
                Send an invitation email with temporary login credentials
              </p>
            </div>

            <form onSubmit={handleInviteAdmin} className="p-6 space-y-4">
              {inviteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  {inviteSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={inviteFormData.name}
                  onChange={(e) => setInviteFormData({ ...inviteFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={inviteFormData.email}
                  onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false)
                    setInviteFormData({ email: '', name: '' })
                    setInviteError(null)
                    setInviteSuccess(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteFormData.email || !inviteFormData.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
