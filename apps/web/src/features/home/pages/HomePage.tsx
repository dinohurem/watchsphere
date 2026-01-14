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
  Star,
  Newspaper,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { SubscriptionOverlay } from '@/components/subscription/SubscriptionOverlay';

// Mini chart component for price trend visualization
function MiniChart({ data }: { data?: number[] }) {
  // Only render if we have actual price history data
  if (!data || data.length < 2) {
    return null;
  }

  const height = 40;
  const width = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Use black color as per Figma design
  const color = '#1D1D1F';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  priceHistory?: number[];
  image?: string;
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
      // First try to load user's personal watchlist
      const response = await api.get('/profile/watchlist');
      if (response.data && response.data.length > 0) {
        setWatchlist(response.data.slice(0, 4).map((item: any) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          reference: item.reference || '',
          price: item.price || item.target_price || 0,
          priceChange: item.priceChange || item.price_change || 0,
          image: item.image || item.cover_image,
        })));
      } else {
        // If user has no watchlist, try to load default watchlist
        try {
          const defaultResponse = await api.get('/default-watchlist/public');
          if (defaultResponse.data && defaultResponse.data.length > 0) {
            setWatchlist(defaultResponse.data.slice(0, 4).map((item: any) => ({
              id: item.id || item.watch_id,
              brand: item.brand,
              model: item.model,
              reference: item.reference || '',
              price: item.price || item.target_price || 0,
              priceChange: item.priceChange || item.price_change || 0,
              image: item.image || item.cover_image,
            })));
          } else {
            setWatchlist([]);
          }
        } catch (defaultError) {
          // If default endpoint fails, show empty watchlist
          setWatchlist([]);
        }
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      // Try default watchlist as fallback
      try {
        const defaultResponse = await api.get('/default-watchlist/public');
        if (defaultResponse.data && defaultResponse.data.length > 0) {
          setWatchlist(defaultResponse.data.slice(0, 4).map((item: any) => ({
            id: item.id || item.watch_id,
            brand: item.brand,
            model: item.model,
            reference: item.reference || '',
            price: item.price || item.target_price || 0,
            priceChange: item.priceChange || item.price_change || 0,
            image: item.image || item.cover_image,
          })));
        } else {
          setWatchlist([]);
        }
      } catch (defaultError) {
        setWatchlist([]);
      }
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
      const response = await api.get('/market/aggregated?limit=4');
      if (response.data && response.data.length > 0) {
        setMarketItems(response.data.map((item: any) => ({
          id: item.reference || item.id,
          brand: item.brand,
          model: item.model || '',
          reference: item.reference || '',
          price: item.display_price || item.price || 0,
          priceChange: item.price_change || 0,
          isPositive: (item.price_change || 0) >= 0,
          priceHistory: item.price_history || [],
          image: item.image_url || item.cover_image,
        })));
      } else {
        // Fallback to regular market endpoint
        const fallbackResponse = await api.get('/market?limit=4');
        if (fallbackResponse.data && fallbackResponse.data.length > 0) {
          setMarketItems(fallbackResponse.data.map((item: any) => ({
            id: item.reference || item.id,
            brand: item.brand,
            model: item.model || '',
            reference: item.reference || '',
            price: item.price || 0,
            priceChange: item.price_change || 0,
            isPositive: (item.price_change || 0) >= 0,
            priceHistory: item.price_history || [],
            image: item.image_url || item.cover_image,
          })));
        } else {
          setMarketItems([]);
        }
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
          source: item.author_name || 'WatchSphere',
          date: formatTimeAgo(item.published_at || item.created_at),
          title: item.title,
          image: item.cover_image || '',
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

  const handleWatchClick = (watch: WatchlistItem | MarketItem) => {
    // Use reference for routing as the watch details page expects reference
    const watchIdentifier = 'reference' in watch && watch.reference ? watch.reference : watch.id;
    navigate(`/app/watch/${encodeURIComponent(watchIdentifier)}`);
  };

  return (
    <SubscriptionOverlay feature="home">
    <div className="p-4 lg:p-6 bg-white min-h-screen">
      <div className="max-w-[1000px] mx-auto flex flex-col gap-16">
      {/* Top Section: Latest Activity + Quick Access */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Latest Activity */}
        <div className="w-full lg:w-[472px] flex flex-col gap-8">
          <h2 className="text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">Latest activity</h2>
          <div className="border border-black/5 rounded-2xl p-4">
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
              <div className="flex flex-col">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-4 rounded-2xl hover:bg-[rgba(29,29,31,0.02)] transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      activity.type === 'offer' ? 'bg-[rgba(0,136,255,0.05)]' : 'bg-[rgba(217,4,41,0.05)]'
                    }`}>
                      {activity.type === 'offer' ? (
                        <Tag className="w-[18px] h-[18px] text-[#0088ff]" />
                      ) : (
                        <TrendingDown className="w-[18px] h-[18px] text-[#d90429]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] leading-[19px] tracking-[0.075px] truncate">
                          <span className="font-normal text-[#212121]">
                            {activity.type === 'offer' ? 'New offer ' : 'Price alert triggered '}
                          </span>
                          <span className="font-semibold text-[#212121]">{activity.reference}</span>
                        </p>
                        <p className="font-semibold text-[15px] leading-[19px] text-[#212121] shrink-0">
                          €{activity.price.toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs leading-[19px] text-[#747474] tracking-[0.06px]">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="flex-1 flex flex-col gap-8">
          <h2 className="text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">Quick Access</h2>
          <div className="flex flex-col gap-4 flex-1">
            {/* First Row */}
            <div className="flex gap-4 flex-1">
              {quickAccessItems.slice(0, 3).map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index}
                    to={item.href}
                    className="flex-1 flex flex-col gap-3 p-4 rounded-2xl border border-black/5 bg-white hover:bg-[rgba(29,29,31,0.02)] transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[15px] font-medium text-[#212121] leading-[19px] tracking-[0.075px]">
                      {item.title}
                    </p>
                  </Link>
                );
              })}
            </div>
            {/* Second Row */}
            <div className="flex gap-4 flex-1">
              {quickAccessItems.slice(3, 6).map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index + 3}
                    to={item.href}
                    className="flex-1 flex flex-col gap-3 p-4 rounded-2xl border border-black/5 bg-white hover:bg-[rgba(29,29,31,0.02)] transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[15px] font-medium text-[#212121] leading-[19px] tracking-[0.075px]">
                      {item.title}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold text-[#212121] leading-[1.1]">Watchlist</h2>
        {loadingWatchlist ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Heart className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-[#212121] mb-2">Your watchlist is empty</h3>
            <p className="text-sm text-[#212121]/50">Start tracking watches to monitor their prices and market trends</p>
          </div>
        ) : (
          <div className="flex gap-8 overflow-x-auto pb-2">
            {watchlist.map((watch) => (
              <div
                key={watch.id}
                onClick={() => handleWatchClick(watch)}
                className="relative border border-black/5 rounded-2xl overflow-hidden cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors bg-white shrink-0 w-[226px]"
              >
                {/* Favorite Button */}
                <button
                  className="absolute top-2 right-2 w-10 h-10 rounded-full bg-[#f4f4f4] flex items-center justify-center z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle favorite toggle
                  }}
                >
                  <Star className="w-[17px] h-[17px] text-[#1d1d1f]" fill="currentColor" />
                </button>
                {/* Watch Image */}
                <div className="h-[150px] bg-gradient-to-b from-white to-[#f4f4f4] flex items-center justify-center rounded-t-xl">
                  {watch.image ? (
                    <img
                      src={watch.image}
                      alt={`${watch.brand} ${watch.reference}`}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <ImagePlaceholder width={120} height={120} borderRadius={0} />
                  )}
                </div>
                {/* Watch Info */}
                <div className="px-4 pb-4 pt-3 flex flex-col gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#212121] leading-[1.3] truncate">
                      {watch.brand} {watch.model}
                    </p>
                    <p className="text-[13px] font-medium text-[#212121]/50 leading-[1.3] truncate">
                      {watch.reference}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-[#212121] leading-[1.3]">
                      {watch.price.toLocaleString()}€
                    </p>
                    <div className={`flex items-center gap-1 px-[7px] py-[3px] rounded-full ${
                      watch.priceChange >= 0 ? 'bg-[rgba(74,160,120,0.05)]' : 'bg-[rgba(201,57,39,0.05)]'
                    }`}>
                      {watch.priceChange >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 text-[#4aa078]" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-[#c93927]" />
                      )}
                      <span className={`text-[11px] font-semibold leading-[1.3] ${
                        watch.priceChange >= 0 ? 'text-[#4aa078]' : 'text-[#c93927]'
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
      <div className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">Market activity</h2>

        {loadingMarket ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : marketItems.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-[#212121] mb-2">No market data available</h3>
            <p className="text-sm text-[#212121]/50">Market listings will appear here once available</p>
          </div>
        ) : (
          <div className="border border-black/5 rounded-2xl overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block pt-8 px-8 pb-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 pr-6 mb-4">
                <div className="w-[200px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">Watch</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">Chart</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">% Change</p>
                </div>
                <div className="w-[168px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">Price</p>
                </div>
                <div className="w-[129px]">
                  <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">Actions</p>
                </div>
              </div>
              {/* Rows */}
              <div className="flex flex-col">
                {marketItems.map((item, index) => (
                  <div
                    key={item.id + '-' + index}
                    className={`flex items-center justify-between gap-3 py-6 cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors ${
                      index < marketItems.length - 1 ? 'border-b border-[rgba(33,33,33,0.05)]' : ''
                    }`}
                    onClick={() => handleWatchClick(item)}
                  >
                    <div className="w-[200px]">
                      <p className="text-base font-semibold text-[#212121] leading-[20px] tracking-[0.08px]">{item.brand} {item.model}</p>
                      <p className="text-base font-medium text-[#212121]/50 leading-[20px] tracking-[0.08px]">{item.reference}</p>
                    </div>
                    <div className="w-[168px]">
                      <MiniChart data={item.priceHistory} />
                    </div>
                    <div className="w-[168px] flex items-center gap-1">
                      {item.isPositive ? (
                        <ArrowUpRight className="w-3 h-3 text-[#4aa078]" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-[#cc6045]" />
                      )}
                      <span className={`text-sm font-normal leading-[16px] ${
                        item.isPositive ? 'text-[#4aa078]' : 'text-[#cc6045]'
                      }`}>
                        {Math.abs(item.priceChange).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-[168px]">
                      <p className="text-base font-semibold text-[#212121] leading-[20px] tracking-[0.08px]">
                        €{item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-[129px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWatchClick(item);
                        }}
                        className="px-5 py-3 bg-[#212121] text-white text-base font-semibold leading-[20px] tracking-[0.08px] rounded-full hover:bg-black transition-colors"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-black/5">
              {marketItems.map((item, index) => (
                <div
                  key={item.id + '-mobile-' + index}
                  onClick={() => handleWatchClick(item)}
                  className="p-4 cursor-pointer hover:bg-[rgba(29,29,31,0.02)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#f5f5f7] flex items-center justify-center overflow-hidden shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.brand} className="w-full h-full object-contain" />
                        ) : (
                          <ImagePlaceholder size={24} />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#212121]">{item.brand} {item.model}</p>
                        <p className="text-sm font-medium text-[#212121]/50">{item.reference}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                      item.isPositive ? 'bg-[rgba(74,160,120,0.05)]' : 'bg-[rgba(201,57,39,0.05)]'
                    }`}>
                      {item.isPositive ? (
                        <ArrowUpRight className="w-3 h-3 text-[#4aa078]" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-[#cc6045]" />
                      )}
                      <span className={`text-sm font-medium ${
                        item.isPositive ? 'text-[#4aa078]' : 'text-[#cc6045]'
                      }`}>
                        {Math.abs(item.priceChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-[#212121]">€{item.price.toLocaleString()}</p>
                    <span className="text-sm font-medium text-[#212121]/50">View details →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trending News Section */}
      <div className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold text-[#1d1d1f]/80 leading-[1.1]">Trending news</h2>
        {loadingNews ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="border border-black/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <Newspaper className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-[#212121] mb-2">No news available</h3>
            <p className="text-sm text-[#212121]/50">Latest watch news will appear here</p>
          </div>
        ) : (
          <div className="flex gap-8 overflow-x-auto">
            {newsItems.map((news) => (
              <div
                key={news.id}
                onClick={() => navigate(`/app/news/${news.id}`)}
                className="flex flex-col cursor-pointer hover:opacity-90 transition-opacity flex-1 min-w-[280px]"
              >
                {/* News Image */}
                <div className="h-[200px] bg-[#e6e6e6] overflow-hidden rounded-t-2xl">
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
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                </div>
                {/* News Content */}
                <div className="bg-white border border-black/5 border-t-0 rounded-b-2xl p-6 h-[178px] flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-[#787789] text-[13px] leading-[20px] tracking-[-0.13px]">
                    <span className="font-medium">{news.source}</span>
                    <span className="text-xs leading-[16px]">·</span>
                    <span className="font-medium">{news.date}</span>
                  </div>
                  <h3 className="text-[20px] font-semibold text-[#212121] leading-normal tracking-[0.1px] line-clamp-3">
                    {news.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
    </SubscriptionOverlay>
  );
}
