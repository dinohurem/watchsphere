import { Bell, Search } from 'lucide-react'

export function Header() {
  const currentHour = new Date().getHours()
  const greeting =
    currentHour < 12 ? 'Good morning' :
    currentHour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <header className="bg-white border-b h-16 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {greeting}, User
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Search className="w-5 h-5 text-gray-600" />
        </button>

        {/* Notifications */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">U</span>
        </div>
      </div>
    </header>
  )
}
