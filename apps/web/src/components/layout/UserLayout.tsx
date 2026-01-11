import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home,
  Store,
  Heart,
  MessageSquare,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  ArrowLeft,
  Watch,
  Sparkles,
  Search
} from 'lucide-react'
import { useAuthStore } from '@watchsphere/shared/stores'

// Custom Chat Icon matching Figma design
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg width="19" height="18" viewBox="0 0 19 18" fill="none" className={className}>
      <path d="M5.83301 6.66632H12.4997" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83301 10.0003H9.99967" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.16634 0.833313C4.56384 0.833313 0.833008 4.56415 0.833008 9.16665C0.833008 10.6675 1.22217 12.0741 1.90134 13.2975L0.833008 17.1666L4.70217 16.0983C5.92551 16.7775 7.33217 17.1666 8.83301 17.1666C13.4355 17.1666 17.1663 13.4358 17.1663 8.83331C17.1663 4.2308 13.769 0.833313 9.16634 0.833313Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Custom Bell Icon matching Figma design
function BellIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M18.3327 15.0003C16.9518 15.0003 15.8327 13.8812 15.8327 12.5003V7.50033C15.8327 4.27866 13.221 1.66699 9.99935 1.66699C6.77768 1.66699 4.16602 4.27866 4.16602 7.50033V12.5003C4.16602 13.8812 3.04685 15.0003 1.66602 15.0003H18.3327Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.56445 18.334C8.85279 18.8298 9.38445 19.1673 10.0003 19.1673C10.6161 19.1673 11.147 18.8298 11.4361 18.334H8.56445Z" fill="currentColor" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const navigation = [
  { name: 'Home', to: '/app', icon: Home },
  { name: 'Market', to: '/app/market', icon: Store },
  { name: 'AI Assistant', to: '/app/ai-assistant', icon: Sparkles },
]

export function UserLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isAdmin = useAuthStore((state) => state.isAdmin)
  const logout = useAuthStore((state) => state.logout)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch profile image on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/profile/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.profile_image_url) {
            setProfileImageUrl(data.profile_image_url)
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
      }
    }
    fetchProfile()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    } else {
      navigate('/app/search')
    }
  }

  const handleSearchFocus = () => {
    navigate('/app/search')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Preview Banner */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white sticky top-0 z-[60]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-10">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Admin Preview Mode — You're viewing the app as users see it
                </span>
              </div>
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-md transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <nav className={`bg-white border-b border-black/10 sticky ${isAdmin ? 'top-10' : 'top-0'} z-50`}>
        <div className="flex items-center justify-between px-8 py-5">
          {/* Left: Logo and Navigation */}
          <div className="flex items-center gap-7 min-w-[280px] shrink-0">
            {/* Logo */}
            <NavLink to="/app" className="flex items-center shrink-0">
              <svg width="40" height="40" viewBox="0 0 77 64" fill="none" className="w-10 h-10">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M47.6224 29.5414H56.6389L58.6424 18.4562H63.6571L61.6535 29.5414H63.6718C70.6808 29.5416 76.3636 35.2013 76.3636 42.182C76.3635 49.1627 70.6807 54.8225 63.6718 54.8227H57.0851L55.4266 64H48.8347L47.1762 54.8227H30.7972L29.1387 64H22.5468L20.8883 54.8227H0.285159V49.9047H52.9591L55.7502 34.4586H48.5111L50.5146 45.5453H45.4984L40.6027 18.4562H45.6189L47.6224 29.5414ZM57.9738 49.9047H63.6718C67.9545 49.9045 71.4271 46.4475 71.4273 42.182C71.4273 37.9165 67.9546 34.4588 63.6718 34.4586H60.7648L57.9738 49.9047Z"
                  fill="#1D1D1F"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17.6533 9.17733H34.0322L35.6907 0H42.2826L43.9412 9.17733H60.3201L61.9786 0H66.9933L65.3348 9.17733H76.3636V14.0953H18.542L21.3345 29.5414H30.351L32.3545 18.4562H37.3707L32.4749 45.5453H27.4588L29.4623 34.4586H22.2232L24.2267 45.5453H19.2106L17.2071 34.4586H12.6903C5.68145 34.4583 0 28.7987 0 21.818C9.25611e-05 14.8545 5.65354 9.20536 12.6386 9.17733L10.9801 0H15.9948L17.6533 9.17733ZM13.5273 14.0953C9.02479 14.0953 4.93572 16.969 4.93562 21.818C4.93562 26.0834 8.40768 29.5411 12.6903 29.5414H16.3184L13.5273 14.0953Z"
                  fill="#1D1D1F"
                />
              </svg>
            </NavLink>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) =>
                    `text-base font-medium tracking-[0.08px] transition-colors whitespace-nowrap ${
                      isActive ? 'text-gray-900' : 'text-gray-900 hover:text-gray-600'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Center: Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden lg:flex flex-1 max-w-[539px] mx-auto">
            <div className="w-full bg-gray-100 rounded-full px-6 py-3 flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Search watches..."
                className="w-full bg-transparent text-[15px] text-gray-900 placeholder-gray-900/50 outline-none"
              />
            </div>
          </form>

          {/* Right: Icons and Profile */}
          <div className="flex items-center justify-end gap-4 w-[250px]">
            <div className="flex items-center gap-2">
              {/* Messages */}
              <button
                onClick={() => navigate('/app/chat')}
                className="relative p-2.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <ChatIcon className="w-5 h-5 text-gray-900" />
                <span className="absolute top-1.5 right-0.5 w-[7px] h-[7px] bg-[#C93927] rounded-full"></span>
              </button>
              {/* Notifications */}
              <button className="relative p-2.5 rounded-full hover:bg-gray-100 transition-colors">
                <BellIcon className="w-5 h-5 text-gray-900" />
                <span className="absolute top-1.5 right-0.5 w-[7px] h-[7px] bg-[#C93927] rounded-full"></span>
              </button>
            </div>

            {/* Profile Avatar with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-600 text-sm font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </button>

              {/* Profile Dropdown - Figma Design */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-[302px] bg-white rounded-xl shadow-[0px_4px_55px_0px_rgba(0,0,0,0.1)] p-6 z-50">
                  {/* Triangle pointer */}
                  <div className="absolute -top-[7px] right-5 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[7px] border-b-white"></div>

                  {/* User Info */}
                  <div className="flex flex-col gap-1 mb-6">
                    <p className="text-[22px] font-semibold text-gray-900 leading-[1.1]">{user?.name || 'User'}</p>
                    <p className="text-base font-medium text-gray-900 opacity-50 leading-[1.1]">{user?.email}</p>
                  </div>

                  {/* Personal Section */}
                  <div className="flex flex-col gap-4 mb-6">
                    <p className="text-xs font-bold text-gray-900 opacity-50 tracking-wide">PERSONAL</p>
                    <div className="flex flex-col">
                      <NavLink
                        to="/app/watchlist"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gray-50 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-gray-900" />
                        <span className="text-base font-medium text-gray-900 tracking-[0.08px]">Favourites</span>
                      </NavLink>
                      <NavLink
                        to="/app/inventory"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gray-50 transition-colors"
                      >
                        <Watch className="w-4 h-4 text-gray-900" />
                        <span className="text-base font-medium text-gray-900 tracking-[0.08px]">Inventory</span>
                      </NavLink>
                      <NavLink
                        to="/app/social-search"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gray-50 transition-colors"
                      >
                        <Search className="w-4 h-4 text-gray-900" />
                        <span className="text-base font-medium text-gray-900 tracking-[0.08px]">Social Search</span>
                      </NavLink>
                    </div>
                  </div>

                  {/* Account Settings Section */}
                  <div className="flex flex-col gap-4">
                    <p className="text-xs font-bold text-gray-900 opacity-50 tracking-wide">ACCOUNT SETTINGS</p>
                    <div className="flex flex-col">
                      <NavLink
                        to="/app/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-900" />
                        <span className="text-base font-medium text-gray-900 tracking-[0.08px]">Profile</span>
                      </NavLink>
                      {isAdmin && (
                        <NavLink
                          to="/admin"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-purple-50 transition-colors"
                        >
                          <Shield className="w-4 h-4 text-purple-700" />
                          <span className="text-base font-medium text-purple-700 tracking-[0.08px]">Admin Panel</span>
                        </NavLink>
                      )}
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false)
                          handleLogout()
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gray-50 transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4 text-gray-900" />
                        <span className="text-base font-medium text-gray-900 tracking-[0.08px]">Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-1">
              {/* Search bar for mobile */}
              <form onSubmit={handleSearchSubmit} className="mb-4">
                <div className="w-full bg-gray-100 rounded-full px-4 py-2.5 flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      setMobileMenuOpen(false)
                      navigate('/app/search')
                    }}
                    placeholder="Search watches..."
                    className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-900/50 outline-none"
                  />
                </div>
              </form>
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  end={item.to === '/app'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}
              <NavLink
                to="/app/watchlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Heart className="w-5 h-5 mr-3" />
                Favourites
              </NavLink>
              <NavLink
                to="/app/social-search"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Search className="w-5 h-5 mr-3" />
                Social Search
              </NavLink>
              <NavLink
                to="/app/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <User className="w-5 h-5 mr-3" />
                Profile
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg"
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Admin Panel
                </NavLink>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Log Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className={`bg-white flex-1 ${isAdmin ? 'h-[calc(100vh-123px)]' : 'h-[calc(100vh-83px)]'}`}>
        <Outlet />
      </main>
    </div>
  )
}
