import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@watchsphere/shared/stores';
import { Settings, Edit2, TrendingUp, TrendingDown, ChevronRight, Heart, ShoppingBag, Tag, User, Star } from 'lucide-react';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface Order {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  price_change: number;
  cover_image: string;
  order_type: 'buy' | 'sell';
  status: string;
}

interface FavoriteWatch {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  price_change: number;
  image: string;
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  profile_image_url: string | null;
  average_rating: number;
  review_count: number;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<FavoriteWatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load profile
      try {
        const profileResponse = await api.get('/profile/me');
        setProfile(profileResponse.data);
      } catch (error) {
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            name: user.name,
            profile_image_url: null,
            average_rating: 0,
            review_count: 0,
          });
        }
      }

      // Load orders
      try {
        const ordersResponse = await api.get('/orders/my-orders');
        if (ordersResponse.data && Array.isArray(ordersResponse.data)) {
          const buyOrdersData: Order[] = [];
          const sellOrdersData: Order[] = [];

          ordersResponse.data.forEach((order: any) => {
            const formattedOrder: Order = {
              id: order.id || order._id,
              brand: order.brand || '',
              model: order.model || '',
              reference: order.reference || '',
              price: order.price || 0,
              price_change: order.price_change || 0,
              cover_image: order.cover_image || '',
              order_type: order.order_type,
              status: order.status || 'active',
            };

            if (order.order_type === 'buy') {
              buyOrdersData.push(formattedOrder);
            } else if (order.order_type === 'sell') {
              sellOrdersData.push(formattedOrder);
            }
          });

          setBuyOrders(buyOrdersData);
          setSellOrders(sellOrdersData);
        }
      } catch (error) {
        console.error('Failed to load orders:', error);
      }

      // Load watchlist
      try {
        const watchlistResponse = await api.get('/profile/watchlist');
        if (watchlistResponse.data && Array.isArray(watchlistResponse.data)) {
          setFavorites(watchlistResponse.data.map((item: any) => ({
            id: item.id || item._id,
            brand: item.brand || '',
            model: item.model || '',
            reference: item.reference || '',
            price: item.target_price || item.price || 0,
            price_change: item.price_change || 0,
            image: item.image || item.cover_image || '',
          })));
        }
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const WatchCard = ({
    brand,
    model,
    reference,
    price,
    priceChange,
    image,
    onClick
  }: {
    brand: string;
    model: string;
    reference: string;
    price: number;
    priceChange: number;
    image: string;
    onClick: () => void;
  }) => {
    const isPositive = priceChange >= 0;

    return (
      <button
        onClick={onClick}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow text-left"
      >
        {/* Image */}
        <div className="h-36 bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
          {image ? (
            <img
              src={image}
              alt={`${brand} ${model}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImagePlaceholder width={80} height={80} borderRadius={0} />
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm truncate">
              {brand} {model}
            </p>
            <p className="text-sm text-gray-500 truncate">{reference}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">
              {price.toLocaleString()}€
            </p>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
              isPositive ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-green-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs font-semibold ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(priceChange).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const EmptyState = ({
    icon: Icon,
    title,
    subtitle
  }: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
  }) => (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-center text-sm">{subtitle}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <button
            onClick={() => navigate('/app/settings')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Profile Section */}
        <div className="flex flex-col items-center mb-10">
          {/* Avatar */}
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {profile?.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <button
              onClick={() => navigate('/app/profile/settings')}
              className="absolute bottom-0 right-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center border-2 border-white hover:bg-gray-800 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* User Name */}
          <h2 className="text-xl font-semibold text-gray-900">
            {profile?.name || user?.name || 'User'}
          </h2>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 text-gray-900 fill-gray-900" />
            <span className="text-sm text-gray-700 font-medium">
              {profile?.average_rating?.toFixed(1) || '0.0'}
            </span>
            <span className="text-sm text-gray-500">
              ({profile?.review_count || 0} reviews)
            </span>
          </div>
        </div>

        {/* Buy Orders Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Buy Orders</h3>
            {buyOrders.length > 0 && (
              <button
                onClick={() => navigate('/app/profile/buy-orders')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className="text-sm font-medium">See All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {buyOrders.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {buyOrders.slice(0, 4).map((order) => (
                <WatchCard
                  key={order.id}
                  brand={order.brand}
                  model={order.model}
                  reference={order.reference}
                  price={order.price}
                  priceChange={order.price_change}
                  image={order.cover_image}
                  onClick={() => navigate(`/app/order/${order.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100">
              <EmptyState
                icon={ShoppingBag}
                title="No buy orders yet"
                subtitle="Create buy orders to see them here"
              />
            </div>
          )}
        </div>

        {/* Sell Orders Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sell Orders</h3>
            {sellOrders.length > 0 && (
              <button
                onClick={() => navigate('/app/profile/sell-orders')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className="text-sm font-medium">See All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {sellOrders.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sellOrders.slice(0, 4).map((order) => (
                <WatchCard
                  key={order.id}
                  brand={order.brand}
                  model={order.model}
                  reference={order.reference}
                  price={order.price}
                  priceChange={order.price_change}
                  image={order.cover_image}
                  onClick={() => navigate(`/app/order/${order.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100">
              <EmptyState
                icon={Tag}
                title="No sell orders yet"
                subtitle="Create sell orders to see them here"
              />
            </div>
          )}
        </div>

        {/* Favorites Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Favorites</h3>
            {favorites.length > 0 && (
              <button
                onClick={() => navigate('/app/watchlist')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className="text-sm font-medium">See All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {favorites.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {favorites.slice(0, 4).map((watch) => (
                <WatchCard
                  key={watch.id}
                  brand={watch.brand}
                  model={watch.model}
                  reference={watch.reference}
                  price={watch.price}
                  priceChange={watch.price_change}
                  image={watch.image}
                  onClick={() => watch.reference && navigate(`/app/watch/${watch.reference}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100">
              <EmptyState
                icon={Heart}
                title="No favorites yet"
                subtitle="Add watches to your watchlist to see them here"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
