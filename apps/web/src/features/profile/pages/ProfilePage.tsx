import { useAuthStore } from '@watchsphere/shared/stores';

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>

      <div className="card mb-4">
        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Name</label>
            <p className="text-lg">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <p className="text-lg">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Role</label>
            <p className="text-lg capitalize">{user?.role}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Verification Status</label>
            <p className="text-lg">{user?.verified ? '✓ Verified' : '⚠️ Not Verified'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <button className="btn-primary mb-2 w-full">Edit Profile</button>
        <button className="btn bg-gray-200 text-gray-800 w-full">Change Password</button>
      </div>
    </div>
  );
}
