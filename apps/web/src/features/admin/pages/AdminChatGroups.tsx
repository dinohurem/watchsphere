import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, Users, UserPlus, UserMinus, Shield } from 'lucide-react'
import { api } from '@/services/api'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'

interface Member {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: 'admin' | 'member'
  joined_at: string
  is_active: boolean
}

interface ChatGroup {
  id: string
  name: string
  description: string | null
  avatar: string | null
  created_by: string | null
  is_active: boolean
  member_count: number
  created_at: string
  members?: Member[]
}

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface GroupFormData {
  name: string
  description: string
  avatar: string
}

const emptyForm: GroupFormData = {
  name: '',
  description: '',
  avatar: '',
}

export function AdminChatGroups() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<ChatGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ChatGroup | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null)
  const [formData, setFormData] = useState<GroupFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  useEffect(() => {
    fetchGroups()
    fetchUsers()
  }, [])

  const fetchGroups = async () => {
    try {
      const response = await api.get('/chat-groups/admin/groups')
      setGroups(response.data)
    } catch (error) {
      console.error('Failed to fetch groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users')
      setAllUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await api.get(`/chat-groups/admin/groups/${groupId}`)
      return response.data as ChatGroup
    } catch (error) {
      console.error('Failed to fetch group details:', error)
      return null
    }
  }

  const handleCreate = () => {
    setEditingGroup(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const handleEdit = (group: ChatGroup) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      description: group.description || '',
      avatar: group.avatar || '',
    })
    setShowModal(true)
    setActionMenuOpen(null)
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? All messages will be lost.')) return
    try {
      await api.delete(`/chat-groups/admin/groups/${groupId}`)
      fetchGroups()
    } catch (error) {
      console.error('Failed to delete group:', error)
    }
    setActionMenuOpen(null)
  }

  const handleViewMembers = async (group: ChatGroup) => {
    const details = await fetchGroupDetails(group.id)
    if (details) {
      setSelectedGroup(details)
      setShowMembersModal(true)
    }
    setActionMenuOpen(null)
  }

  const handleOpenAddMember = async (group: ChatGroup) => {
    const details = await fetchGroupDetails(group.id)
    if (details) {
      setSelectedGroup(details)
      setSelectedUserIds([])
      setShowAddMemberModal(true)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return
    if (!confirm('Are you sure you want to remove this member?')) return
    try {
      await api.delete(`/chat-groups/admin/groups/${selectedGroup.id}/members/${userId}`)
      const updated = await fetchGroupDetails(selectedGroup.id)
      if (updated) setSelectedGroup(updated)
      fetchGroups()
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedUserIds.length === 0) return
    try {
      await api.post(`/chat-groups/admin/groups/${selectedGroup.id}/members`, {
        user_ids: selectedUserIds,
      })
      const updated = await fetchGroupDetails(selectedGroup.id)
      if (updated) setSelectedGroup(updated)
      fetchGroups()
      setShowAddMemberModal(false)
      setSelectedUserIds([])
    } catch (error) {
      console.error('Failed to add members:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        ...formData,
        description: formData.description || undefined,
        avatar: formData.avatar || undefined,
      }

      if (editingGroup) {
        await api.patch(`/chat-groups/admin/groups/${editingGroup.id}`, payload)
      } else {
        await api.post('/chat-groups/admin/groups', payload)
      }

      setShowModal(false)
      fetchGroups()
    } catch (error) {
      console.error('Failed to save group:', error)
    } finally {
      setSaving(false)
    }
  }

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const existingMemberIds = selectedGroup?.members?.map(m => m.user_id) || []
  const availableUsers = allUsers.filter(u => !existingMemberIds.includes(u.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat Groups</h1>
          <p className="text-gray-600">Manage chat groups ({groups.length} total)</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="border rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    {group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-500">{group.member_count} members</p>
                  </div>
                </div>
                <ActionMenu
                  isOpen={actionMenuOpen === group.id}
                  onToggle={() => setActionMenuOpen(actionMenuOpen === group.id ? null : group.id)}
                  onClose={() => setActionMenuOpen(null)}
                >
                  <ActionMenuItem
                    onClick={() => handleViewMembers(group)}
                    icon={<Users className="w-4 h-4" />}
                  >
                    View Members
                  </ActionMenuItem>
                  <ActionMenuItem
                    onClick={() => handleEdit(group)}
                    icon={<Edit2 className="w-4 h-4" />}
                  >
                    Edit
                  </ActionMenuItem>
                  <ActionMenuItem
                    onClick={() => handleDelete(group.id)}
                    variant="danger"
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </ActionMenuItem>
                </ActionMenu>
              </div>
              {group.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{group.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full ${group.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {group.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-400">
                  Created {new Date(group.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No groups found matching your criteria
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., Watch Enthusiasts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="What is this group about?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                <input
                  type="url"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingGroup ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Group Members</h2>
                <p className="text-sm text-gray-500">{selectedGroup.name}</p>
              </div>
              <button
                onClick={() => {
                  handleOpenAddMember(selectedGroup)
                  setShowMembersModal(false)
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {selectedGroup.members?.filter(m => m.is_active).map((member) => (
                <div key={member.id} className="flex items-center justify-between px-6 py-3 border-b last:border-b-0 hover:bg-gray-50">
                  <button
                    onClick={() => navigate(`/app/user/${member.user_id}`)}
                    className="flex items-center hover:opacity-70 transition-opacity"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm font-medium">
                        {member.user_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{member.user_name}</span>
                        {member.role === 'admin' && (
                          <Shield className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{member.user_email}</span>
                    </div>
                  </button>
                  {member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {(!selectedGroup.members || selectedGroup.members.filter(m => m.is_active).length === 0) && (
                <div className="p-8 text-center text-gray-500">
                  No members in this group
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Add Members</h2>
              <p className="text-sm text-gray-500">Select users to add to {selectedGroup.name}</p>
            </div>

            <div className="overflow-y-auto max-h-[50vh]">
              {availableUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center px-6 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, user.id])
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id))
                      }
                    }}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <div className="ml-3 flex items-center">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3">
                      <span className="text-sm font-medium text-gray-900">{user.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{user.email}</span>
                    </div>
                  </div>
                </label>
              ))}

              {availableUsers.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No more users available to add
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddMemberModal(false)
                  setShowMembersModal(true)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={selectedUserIds.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''} Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
