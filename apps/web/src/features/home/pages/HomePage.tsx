import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import {
  Activity,
  Search,
  ShoppingCart,
  Tag,
  Bot,
  Package,
  ClipboardList,
  ShieldCheck,
  Grid3x3
} from 'lucide-react';

export function HomePage() {
  const user = useAuthStore((state) => state.user);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const quickAccessButtons = [
    {
      icon: Activity,
      title: 'Activity Center',
      subtitle: 'All your updates — matches, payments, shipping and alerts in one place.',
      href: '#'
    },
    {
      icon: Search,
      title: 'Smart Search',
      subtitle: 'Find watches worldwide with intelligent filters and live matches.',
      href: '/market'
    },
    {
      icon: ShoppingCart,
      title: 'Buy',
      subtitle: 'Buy from verified dealers in your chosen market region.',
      href: '/market'
    },
    {
      icon: Tag,
      title: 'Sell',
      subtitle: 'List your watches for sale and connect with active buyers.',
      href: '/dashboard'
    },
    {
      icon: Bot,
      title: 'Ask AI Assistant',
      subtitle: 'Your personal assistant, 24/7.',
      href: '/chat'
    },
    {
      icon: Package,
      title: 'My Inventory',
      subtitle: 'Manage, edit and track your full watch stock in real time.',
      href: '/dashboard'
    },
    {
      icon: ClipboardList,
      title: 'My Orders',
      subtitle: 'View and manage all your active buy orders.',
      href: '#'
    },
    {
      icon: ShieldCheck,
      title: 'Checks',
      subtitle: 'Avoid risk — check your serials and close deals confidently.',
      href: '#'
    },
    {
      icon: Grid3x3,
      title: 'All Tools',
      subtitle: 'Everything else you need — organized in one place.',
      href: '#'
    },
  ];

  const newsItems = [
    { icon: '📰', text: 'Patek increases Nautilus production by 5%', source: 'Bloomberg' },
    { icon: '📈', text: 'Submariner prices stabilize after -2.1% dip', source: 'Market Watch' },
    { icon: '🔧', text: 'Rolex service delays still affecting secondary market', source: 'WatchPro' },
    { icon: '📦', text: 'Phillips Geneva Auction – 5711/1A sold for €103,000', source: 'Phillips' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
          {greeting}, {user?.name}.
        </h1>
        <p className="text-gray-600">Here's what's happening with your watches today.</p>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {quickAccessButtons.map((btn, idx) => {
          const Icon = btn.icon;
          return (
            <Link
              key={idx}
              to={btn.href}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary transition-colors">
                    {btn.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {btn.subtitle}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Customize Section */}
      <div className="mb-8">
        <button className="w-full bg-white rounded-xl p-6 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50 transition-all text-center group">
          <p className="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors">
            Customize your Homescreen
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Add, remove or rearrange your main tools.
          </p>
        </button>
      </div>

      {/* Market News */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest from the Market</h2>
        <div className="space-y-4">
          {newsItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <p className="text-base text-gray-900 font-medium">{item.text}</p>
                <p className="text-sm text-gray-600 mt-1">— source: {item.source}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full mt-6 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors">
          View all News
        </button>
      </div>
    </div>
  );
}
