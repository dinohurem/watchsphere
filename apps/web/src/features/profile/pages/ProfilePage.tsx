import { useAuthStore } from '@watchsphere/shared/stores';
import { User, Clock, Star, Bell, FileText, Languages, Lock, Database, ChevronRight, LogOut } from 'lucide-react';

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        </div>

        {/* Profile Image Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <User size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">{user?.name}</h2>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>

          <div className="space-y-1">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">History</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Reviews</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Settings</h2>

          <div className="space-y-1">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Theme</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Languages className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Language</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy</h2>

          <div className="space-y-1">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Privacy Policy</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Terms and Conditions</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-gray-700" />
                </div>
                <span className="font-medium text-gray-900">Data</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
