import { useEffect, useState } from 'react'
import { Search, Check, X, Trash2, UserPlus, Mail, Star, Eye } from 'lucide-react'
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
  average_rating: number
  review_count: number
  created_at: string
  auth_provider?: 'email' | 'google' | 'apple'
}

interface Review {
  id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_profile_image?: string
  reviewed_user_id: string
  reviewed_user_name: string
  rating: number
  comment?: string
  created_at: string
}

interface UserReviewStats {
  user_id: string
  user_name: string
  average_rating: number
  review_count: number
  reviews: Review[]
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

function AuthProviderBadge({ provider }: { provider?: 'email' | 'google' | 'apple' }) {
  if (!provider || provider === 'email') {
    return null
  }

  const config = {
    google: {
      label: 'Google',
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      className: 'bg-white border border-gray-200 text-gray-700',
    },
    apple: {
      label: 'Apple',
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
        </svg>
      ),
      className: 'bg-black text-white',
    },
  }

  const { label, icon, className } = config[provider]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {icon}
      {label}
    </span>
  )
}

function RatingDisplay({ rating, count }: { rating: number; count: number }) {
  if (count === 0) {
    return <span className="text-xs text-gray-400">No reviews</span>
  }
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-500">({count})</span>
    </div>
  )
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
  const [showReviewsModal, setShowReviewsModal] = useState(false)
  const [selectedUserReviews, setSelectedUserReviews] = useState<UserReviewStats | null>(null)
  const [loadingReviews, setLoadingReviews] = useState(false)

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

  const handleViewReviews = async (userId: string) => {
    setLoadingReviews(true)
    setShowReviewsModal(true)
    setActionMenuOpen(null)

    try {
      const response = await api.get(`/reviews/admin/user/${userId}`)
      setSelectedUserReviews(response.data)
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
      setSelectedUserReviews(null)
    } finally {
      setLoadingReviews(false)
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{user.name}</span>
                          <AuthProviderBadge provider={user.auth_provider} />
                        </div>
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewReviews(user.id)}
                      className="hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                    >
                      <RatingDisplay rating={user.average_rating || 0} count={user.review_count || 0} />
                    </button>
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
                      <ActionMenuItem
                        onClick={() => handleViewReviews(user.id)}
                        icon={<Eye className="w-4 h-4" />}
                      >
                        View Reviews
                      </ActionMenuItem>
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

      {/* Reviews Modal */}
      {showReviewsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Reviews for {selectedUserReviews?.user_name || 'User'}
                </h2>
                {selectedUserReviews && (
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{selectedUserReviews.average_rating.toFixed(1)}</span>
                    <span className="text-gray-500">({selectedUserReviews.review_count} reviews)</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowReviewsModal(false)
                  setSelectedUserReviews(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingReviews ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : selectedUserReviews?.reviews.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedUserReviews?.reviews.map((review) => (
                    <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {review.reviewer_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{review.reviewer_name}</p>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= review.rating
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="mt-3 text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
