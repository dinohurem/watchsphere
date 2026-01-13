import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface InventoryItem {
  id: string;
  brand: string;
  model: string;
  reference?: string;
  price: number;
  currency: string;
  condition: string;
  year?: number;
  description?: string;
  cover_image?: string;
  status: string;
  views: number;
  created_at: string;
  updated_at?: string;
  price_change?: number;
}

export function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const response = await api.get('/inventory');
      setInventory(response.data);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  // Empty state
  if (!loading && inventory.length === 0) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex flex-col items-center justify-center">
        {/* Watch icon */}
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="6" />
            <path d="M12 8v4l2 2" />
            <path d="M9 2h6M9 22h6" />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Add new watch to your inventory</h2>
        <p className="text-gray-500 text-center mb-8 max-w-sm">
          Sell your watches and manage them all in one place.
        </p>

        <button
          onClick={() => navigate('/app/inventory/create')}
          className="px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
        >
          Create new listing
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/app" className="hover:text-gray-900">Home</Link>
        <span>/</span>
        <span className="text-gray-900">Inventory</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Inventory</h1>
        <button
          onClick={() => navigate('/app/inventory/create')}
          className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
        >
          Create new listing
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : (
        /* Inventory Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {inventory.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/app/watch/${item.reference || item.id}`)}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {/* Watch Image */}
              <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                {item.cover_image ? (
                  <img
                    src={item.cover_image}
                    alt={`${item.brand} ${item.model}`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImagePlaceholder width={180} height={180} borderRadius={0} />
                )}
              </div>

              {/* Watch Info */}
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-0.5">
                  {item.brand} {item.model}
                </h3>
                <p className="text-sm text-gray-500 mb-3">{item.reference}</p>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    {item.price.toLocaleString()}
                    {item.currency === 'EUR' ? '€' : item.currency === 'USD' ? '$' : item.currency}
                  </span>
                  {item.price_change !== undefined && (
                    <span className={`text-sm ${item.price_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.price_change >= 0 ? '↗' : '↘'} {Math.abs(item.price_change).toFixed(1)}%
                    </span>
                  )}
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
