import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import {
  Search,
  ShoppingCart,
  Bot,
  ClipboardList,
  TrendingUp,
  Heart
} from 'lucide-react';
import { api } from '@/services/api';

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Extract first name from full name
  const firstName = useMemo(() => {
    return user?.name ? user.name.split(' ')[0] : 'User';
  }, [user?.name]);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/watchlist');
      setWatchlist(response.data.slice(0, 3)); // Show only first 3
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      setWatchlist([]);
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const quickAccessButtons = [
    {
      icon: Search,
      title: 'Smart Search',
      subtitle: 'Find watches worldwide with intelligent filters and live matches.',
      href: '/market'
    },
    {
      icon: ShoppingCart,
      title: 'Browse Market',
      subtitle: 'Explore watches from verified dealers in your preferred region.',
      href: '/market'
    },
    {
      icon: Heart,
      title: 'My Watchlist',
      subtitle: 'Track price changes and get alerts on your favorite watches.',
      href: '/watchlist'
    },
    {
      icon: Bot,
      title: 'Ask AI Assistant',
      subtitle: 'Your personal watch expert, available 24/7.',
      href: '/chat'
    },
    {
      icon: ClipboardList,
      title: 'My Orders',
      subtitle: 'View and track all your watch purchases.',
      href: '#'
    },
    {
      icon: TrendingUp,
      title: 'Market Trends',
      subtitle: 'Discover trending watches and market insights.',
      href: '/market'
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
          {greeting}, {firstName}.
        </h1>
        <p className="text-gray-600">Here's what's happening with your watches today.</p>
      </div>

      {/* My Watchlist Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">My Watchlist</h2>
          <Link
            to="/watchlist"
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            View All
            <span>→</span>
          </Link>
        </div>

        {loadingWatchlist ? (
          <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
            <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">Your watchlist is empty</p>
            <Link
              to="/market"
              className="inline-block px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
            >
              Browse Watches
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlist.map((watch) => (
              <div
                key={watch.id}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Watch Image Placeholder */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">⌚</span>
                  </div>

                  {/* Watch Info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {watch.brand} {watch.model}
                    </h3>
                    <p className="text-sm text-gray-600">{watch.reference}</p>
                  </div>

                  {/* Mini Chart Placeholder */}
                  <div className="hidden md:block w-24 h-12 bg-gray-50 rounded"></div>

                  {/* Price Info */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      €{watch.price?.toLocaleString() || 'N/A'}
                    </p>
                    <p className={`text-sm font-medium ${
                      watch.priceChange > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {watch.priceChange > 0 ? '▲' : '▼'} {Math.abs(watch.priceChange || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Quick Access</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
