import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Heart, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

export function WatchlistPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/profile/watchlist');
      setWatchlist(response.data);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (watchId: string) => {
    try {
      await api.delete(`/watchlist/${watchId}`);
      setWatchlist(watchlist.filter(w => w.id !== watchId));
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Watchlist</h1>
          <p className="text-gray-600">
            Track price changes and get alerts on your favorite watches
          </p>
        </div>

        {/* Watchlist Count */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {loading ? 'Loading...' : `${watchlist.length} watch${watchlist.length !== 1 ? 'es' : ''} in your watchlist`}
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : watchlist.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
            <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your watchlist is empty</h3>
            <p className="text-gray-600 mb-6">
              Start tracking watches to monitor their prices and market trends
            </p>
            <a
              href="/market"
              className="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
            >
              Browse Market
            </a>
          </div>
        ) : (
          /* Watchlist Grid */
          <div className="grid grid-cols-1 gap-4">
            {watchlist.map((watch) => {
              const hasPositiveChange = (watch.priceChange || 0) > 0;

              return (
                <div
                  key={watch.id}
                  className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center gap-6">
                    {/* Watch Image */}
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {watch.image ? (
                        <img
                          src={watch.image}
                          alt={`${watch.brand} ${watch.model}`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'w-full h-full flex items-center justify-center';
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      ) : (
                        <ImagePlaceholder width={128} height={128} borderRadius={8} />
                      )}
                    </div>

                    {/* Watch Info */}
                    <div className="flex-1">
                      <div className="mb-3">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-1">
                          {watch.brand} {watch.model}
                        </h3>
                        <p className="text-sm text-gray-600">{watch.reference}</p>
                      </div>

                      <div className="flex items-center gap-6 mb-3">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Current Price</p>
                          <p className="text-3xl font-bold text-gray-900">
                            €{watch.price?.toLocaleString() || 'N/A'}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600 mb-1">Price Change</p>
                          <div className="flex items-center gap-2">
                            {hasPositiveChange ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                            <p className={`text-xl font-semibold ${
                              hasPositiveChange ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {hasPositiveChange ? '+' : ''}{watch.priceChange?.toFixed(1) || '0.0'}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="flex flex-wrap gap-3 text-sm">
                        {watch.condition && (
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700 capitalize">
                            {watch.condition}
                          </span>
                        )}
                        {watch.year && (
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                            Year: {watch.year}
                          </span>
                        )}
                        {watch.location && (
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                            {watch.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini Chart Placeholder */}
                    <div className="hidden lg:block w-40 h-24 bg-gray-50 rounded-lg"></div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => watch.reference && navigate(`/app/watch/${watch.reference}`)}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleRemove(watch.id)}
                        className="px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
