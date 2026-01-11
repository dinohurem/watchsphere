import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Sparkles,
  FileCheck,
  ShieldCheck,
  Watch,
  Grid3X3,
  Tag,
  TrendingUp,
  TrendingDown,
  Heart,
  Newspaper
} from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface ActivityItem {
  id: string;
  type: 'offer' | 'alert';
  reference: string;
  price: number;
  time: string;
}

interface WatchlistItem {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  image?: string;
}

interface MarketItem {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  priceChange: number;
  isPositive: boolean;
}

interface NewsItem {
  id: string;
  source: string;
  date: string;
  title: string;
  image: string;
}

export function HomePage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  // Quick access items
  const quickAccessItems = [
    { icon: Activity, title: 'Activity Center', color: 'bg-[#ff7373]', href: '/app/activity' },
    { icon: Sparkles, title: 'Ask AI Assistant', color: 'bg-[#d573ff]', href: '/app/ai-assistant' },
    { icon: FileCheck, title: 'My Orders', color: 'bg-[#32d287]', href: '/app/orders' },
    { icon: ShieldCheck, title: 'Checks', color: 'bg-[#7c73ff]', href: '/app/checks' },
    { icon: Watch, title: 'My Inventory', color: 'bg-[#767676]', href: '/app/inventory' },
    { icon: Grid3X3, title: 'All Tools', color: 'bg-[#73beff]', href: '/app/tools' },
  ];

  useEffect(() => {
    loadWatchlist();
    loadActivities();
    loadMarketData();
    loadNews();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/profile/watchlist');
      if (response.data && response.data.length > 0) {
        setWatchlist(response.data.slice(0, 4).map((item: any) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          price: item.price || item.target_price || 0,
          priceChange: item.priceChange || 0,
          image: item.image,
        })));
      } else {
        setWatchlist([]);
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      setWatchlist([]);
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const loadActivities = async () => {
    try {
      const response = await api.get('/activity/admin/activity?limit=3');
      if (response.data && response.data.length > 0) {
        setActivities(response.data.map((item: any) => ({
          id: item.id,
          type: item.activity_type === 'price_alert' ? 'alert' : 'offer',
          reference: item.metadata?.reference || item.entity_id || '',
          price: item.metadata?.price || 0,
          time: formatTimeAgo(item.created_at),
        })));
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const loadMarketData = async () => {
    try {
      const response = await api.get('/market?limit=4');
      if (response.data && response.data.length > 0) {
        setMarketItems(response.data.map((item: any) => ({
          id: item.id,
          brand: item.brand,
          model: item.model || '',
          reference: item.reference || '',
          price: item.price || 0,
          priceChange: item.price_change || 0,
          isPositive: (item.price_change || 0) >= 0,
        })));
      } else {
        setMarketItems([]);
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
      setMarketItems([]);
    } finally {
      setLoadingMarket(false);
    }
  };

  const loadNews = async () => {
    try {
      const response = await api.get('/news?limit=3');
      if (response.data && response.data.length > 0) {
        setNewsItems(response.data.map((item: any) => ({
          id: item.id,
          source: item.source || 'WatchSphere',
          date: formatTimeAgo(item.published_at || item.created_at),
          title: item.title,
          image: item.image_url || '',
        })));
      } else {
        setNewsItems([]);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
      setNewsItems([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleWatchClick = (watchId: string) => {
    navigate(`/app/watch/${watchId}`);
  };

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-0 py-6 sm:py-8 space-y-10 sm:space-y-16">
      {/* Top Section: Latest Activity + Quick Access */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Latest Activity */}
        <div className="w-full lg:w-[472px] flex flex-col gap-6 lg:gap-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 opacity-80">Latest activity</h2>
          <div className="border border-black/5 rounded-2xl p-3 sm:p-4">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            ) : (
              activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 p-3 sm:p-4 ${
                    index === 1 ? 'bg-gray-50/50 rounded-2xl' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    activity.type === 'offer' ? 'bg-blue-500/5' : 'bg-red-500/5'
                  }`}>
                    {activity.type === 'offer' ? (
                      <Tag className="w-[18px] h-[18px] text-blue-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm sm:text-[15px] tracking-[0.075px] truncate">
                        <span className="font-normal text-gray-900">
                          {activity.type === 'offer' ? 'New offer' : 'Price alert triggered '}
                        </span>
                        <span className="font-semibold text-gray-900">{activity.reference}</span>
                      </p>
                      <p className="font-semibold text-sm sm:text-[15px] text-gray-900 shrink-0">
                        €{activity.price.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 tracking-[0.06px]">{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="flex-1 flex flex-col gap-6 lg:gap-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 opacity-80">Quick Access</h2>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {quickAccessItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={index}
                  to={item.href}
                  className={`flex flex-col gap-3 p-3 sm:p-4 rounded-2xl border border-black/5 hover:shadow-md transition-shadow ${
                    index === 1 ? 'bg-gray-50/50' : 'bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm sm:text-[15px] font-medium text-gray-900 tracking-[0.075px]">
                    {item.title}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="flex flex-col gap-6 sm:gap-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 opacity-80">Watchlist</h2>
        {loadingWatchlist ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Heart className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Your watchlist is empty</h3>
            <p className="text-sm text-gray-500">Start tracking watches to monitor their prices and market trends</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {watchlist.map((watch) => (
              <div
                key={watch.id}
                onClick={() => handleWatchClick(watch.id)}
                className="bg-white border border-black/5 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              >
                {/* Watch Image */}
                <div className="h-[120px] sm:h-[150px] bg-gradient-to-b from-white to-gray-100 flex items-center justify-center">
                  {watch.image ? (
                    <img
                      src={watch.image}
                      alt={`${watch.brand} ${watch.reference}`}
                      className="h-[85%] w-auto object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <ImagePlaceholder width={100} height={100} borderRadius={0} />
                  )}
                </div>
                {/* Watch Info */}
                <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
                  <div>
                    <p className="text-xs sm:text-[13px] font-semibold text-gray-900 leading-[1.3] truncate">
                      {watch.brand}
                    </p>
                    <p className="text-xs sm:text-[13px] font-medium text-gray-900 opacity-50 leading-[1.3] truncate">
                      {watch.reference}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm sm:text-[15px] font-semibold text-gray-900 leading-[1.3]">
                      {watch.price.toLocaleString()}€
                    </p>
                    <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-[7px] py-[2px] sm:py-[3px] rounded-full ${
                      watch.priceChange >= 0 ? 'bg-green-600/5' : 'bg-red-600/5'
                    }`}>
                      {watch.priceChange >= 0 ? (
                        <TrendingUp className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-red-600" />
                      )}
                      <span className={`text-[10px] sm:text-[11px] font-semibold leading-[1.3] ${
                        watch.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {Math.abs(watch.priceChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market Activity Section */}
      <div className="flex flex-col gap-6 sm:gap-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 opacity-80">Market activity</h2>

        {loadingMarket ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : marketItems.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No market data available</h3>
            <p className="text-sm text-gray-500">Market listings will appear here once available</p>
          </div>
        ) : (
          <>
        {/* Desktop Table */}
        <div className="hidden lg:block border border-black/5 rounded-2xl pt-8 pb-4 px-8">
          {/* Table Header */}
          <div className="flex items-center justify-between pr-6 mb-4">
            <p className="w-[200px] text-base font-medium text-gray-900 opacity-50 tracking-[0.08px]">Watch</p>
            <p className="w-[168px] text-base font-medium text-gray-900 opacity-50 tracking-[0.08px]">Chart</p>
            <p className="w-[168px] text-base font-medium text-gray-900 opacity-50 tracking-[0.08px]">% Change</p>
            <p className="w-[168px] text-base font-medium text-gray-900 opacity-50 tracking-[0.08px]">Price</p>
            <p className="w-[129px] text-base font-medium text-gray-900 opacity-50 tracking-[0.08px]">Actions</p>
          </div>
          {/* Table Rows */}
          <div className="flex flex-col">
            {marketItems.map((item, index) => (
              <div
                key={item.id + '-' + index}
                className={`flex items-center justify-between py-6 ${
                  index < marketItems.length - 1 ? 'border-b border-gray-900/5' : ''
                }`}
              >
                <div className="w-[200px]">
                  <p className="text-base font-semibold text-gray-900 tracking-[0.08px]">{item.brand}</p>
                  <p className="text-base font-medium text-gray-900 opacity-50">{item.reference}</p>
                </div>
                {/* Mini Chart Placeholder */}
                <div className="w-[168px] h-[50px] flex items-center">
                  <svg viewBox="0 0 168 50" className="w-full h-full">
                    <path
                      d={item.isPositive
                        ? "M0,40 Q20,35 40,30 T80,25 T120,15 T168,10"
                        : "M0,10 Q20,15 40,20 T80,25 T120,35 T168,40"
                      }
                      fill="none"
                      stroke={item.isPositive ? '#4aa078' : '#cc6045'}
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="w-[168px] flex items-center gap-1">
                  {item.isPositive ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-orange-600" />
                  )}
                  <span className={`text-sm font-mono ${
                    item.isPositive ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {item.priceChange}%
                  </span>
                </div>
                <p className="w-[168px] text-base font-semibold text-gray-900 tracking-[0.08px]">
                  €{item.price.toLocaleString()}
                </p>
                <button
                  onClick={() => handleWatchClick(item.id)}
                  className="h-11 px-5 bg-gray-900 text-white text-base font-semibold rounded-2xl hover:bg-gray-800 transition-colors tracking-[0.08px]"
                >
                  View details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {marketItems.map((item, index) => (
            <div
              key={item.id + '-mobile-' + index}
              onClick={() => handleWatchClick(item.id)}
              className="border border-black/5 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">{item.brand}</p>
                  <p className="text-sm font-medium text-gray-900 opacity-50">{item.reference}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  item.isPositive ? 'bg-green-600/5' : 'bg-red-600/5'
                }`}>
                  {item.isPositive ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-orange-600" />
                  )}
                  <span className={`text-sm font-mono ${
                    item.isPositive ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {item.priceChange}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-gray-900">€{item.price.toLocaleString()}</p>
                <span className="text-sm font-medium text-gray-500">View details →</span>
              </div>
            </div>
          ))}
        </div>
          </>
        )}
      </div>

      {/* Trending News Section */}
      <div className="flex flex-col gap-6 sm:gap-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 opacity-80">Trending news</h2>
        {loadingNews ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Newspaper className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No news available</h3>
            <p className="text-sm text-gray-500">Latest watch news will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {newsItems.map((news) => (
              <div key={news.id} className="cursor-pointer hover:shadow-lg transition-shadow rounded-2xl overflow-hidden">
                {/* News Image */}
                <div className="h-[160px] sm:h-[200px] bg-gray-200 overflow-hidden">
                  {news.image ? (
                    <img
                      src={news.image}
                      alt={news.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Newspaper className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                </div>
                {/* News Content */}
                <div className="bg-white border border-black/5 border-t-0 p-4 sm:p-6 min-h-[140px] sm:min-h-[178px] rounded-b-2xl">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 text-gray-500 text-xs sm:text-[13px] tracking-[-0.13px]">
                      <span className="font-medium">{news.source}</span>
                      <span>·</span>
                      <span className="font-medium">{news.date}</span>
                    </div>
                    <h3 className="text-base sm:text-xl font-semibold text-gray-900 tracking-[0.1px] line-clamp-3">
                      {news.title}
                    </h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
