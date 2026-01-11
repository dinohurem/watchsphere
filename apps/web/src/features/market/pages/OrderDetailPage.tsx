import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  Star,
  MoreVertical,
  Edit,
  CheckCircle,
  Trash2,
  X,
  Check,
  User
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

interface OrderDetail {
  id: string;
  order_type: 'buy' | 'sell';
  brand: string;
  model: string;
  reference: string;
  watch_id?: string;
  price: number;
  currency: string;
  condition: string;
  country_code: string;
  country_name?: string;
  user_id: string;
  user_name?: string;
  user_profile_image?: string;
  user_rating: number;
  user_review_count: number;
  status: string;
  notes?: string;
  has_box: boolean;
  has_papers: boolean;
  created_at: string;
  // Watch details
  watch_details?: {
    image_url?: string;
    images?: string[];
    year?: number;
    movement?: string;
    case_material?: string;
    bracelet_material?: string;
    case_size?: string;
    water_resistance?: string;
    caliber?: string;
    power_reserve?: string;
    number_of_jewels?: number;
    crystal?: string;
    dial?: string;
    bezel_material?: string;
    clasp?: string;
  };
}

interface SimilarListing {
  id: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  price_change?: number;
  image_url?: string;
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [similarListings, setSimilarListings] = useState<SimilarListing[]>([]);

  // Mark as sold state
  const [showMarkSoldModal, setShowMarkSoldModal] = useState(false);
  const [showSaleComplete, setShowSaleComplete] = useState(false);
  const [markingAsSold, setMarkingAsSold] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnOrder = user?.id === order?.user_id;

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);

      // Fetch similar listings
      if (response.data.reference) {
        try {
          const similarResponse = await api.get('/market/aggregated', {
            params: { limit: 4 }
          });
          setSimilarListings(similarResponse.data || []);
        } catch (error) {
          console.error('Failed to fetch similar listings:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!orderId) return;

    setMarkingAsSold(true);
    try {
      await api.post(`/orders/${orderId}/mark-sold`);
      setShowMarkSoldModal(false);
      setShowSaleComplete(true);
    } catch (error) {
      console.error('Failed to mark as sold:', error);
    } finally {
      setMarkingAsSold(false);
    }
  };

  const handleDelete = async () => {
    if (!orderId) return;

    setDeleting(true);
    try {
      await api.delete(`/orders/${orderId}`);
      navigate(-1);
    } catch (error) {
      console.error('Failed to delete order:', error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleWatchlist = () => {
    setIsInWatchlist(!isInWatchlist);
  };

  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto py-8 text-center">
        <p className="text-gray-500">Order not found</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  // Sale completed screen
  if (showSaleComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Sale completed</h1>
          <p className="text-gray-500 mb-8">
            Your watch has been marked as sold. Thank you for keeping your inventory up to date.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/app')}
              className="px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Go to Inventory
            </button>
            <button
              onClick={() => navigate('/app/market')}
              className="text-gray-700 font-medium hover:text-gray-900 transition-colors"
            >
              Back to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const images = order.watch_details?.images || [];
  const mainImage = order.watch_details?.image_url || images[selectedImage];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5 text-gray-900" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {order.brand} {order.model}
            </h1>
            <p className="text-sm sm:text-base text-gray-500">{order.reference}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Share2 className="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" />
          </button>

          {isOwnOrder ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <MoreVertical className="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      // Navigate to edit (can be implemented later)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowMarkSoldModal(true);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as sold
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={toggleWatchlist}
              className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full border flex items-center justify-center transition-colors ${
                isInWatchlist
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Star
                className={`w-4 sm:w-5 h-4 sm:h-5 ${isInWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Images & Info */}
        <div className="lg:w-[400px] space-y-6">
          {/* Main Image */}
          <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
            {mainImage ? (
              <img
                src={mainImage}
                alt={`${order.brand} ${order.model}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <ImagePlaceholder size={200} borderRadius={0} />
            )}
          </div>

          {/* Thumbnail Gallery */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    selectedImage === idx ? 'border-gray-900' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Price & Quick Info */}
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                €{order.price.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                Added {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Condition:</p>
                <p className="font-medium text-gray-900">{order.condition}</p>
              </div>
              <div>
                <p className="text-gray-500">Case size:</p>
                <p className="font-medium text-gray-900">{order.watch_details?.case_size || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Box/papers:</p>
                <p className="font-medium text-gray-900">
                  {order.has_box && order.has_papers
                    ? 'Original box and papers'
                    : order.has_box
                    ? 'Box only'
                    : order.has_papers
                    ? 'Papers only'
                    : 'None'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Location:</p>
                <p className="font-medium text-gray-900 flex items-center gap-1">
                  {getFlagEmoji(order.country_code)} {order.country_name || order.country_code}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            {!isOwnOrder && order.order_type === 'sell' && (
              <div className="flex gap-3">
                <button className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors">
                  Buy Now
                </button>
                <button className="flex-1 py-3 border border-gray-200 text-gray-900 font-semibold rounded-full hover:bg-gray-50 transition-colors">
                  Make offer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Specifications */}
        <div className="flex-1 space-y-8">
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic info</h2>
            <div className="space-y-3">
              <SpecRow label="Brand" value={order.brand} />
              <SpecRow label="Model" value={order.model} />
              <SpecRow label="Reference" value={order.reference} />
              <SpecRow label="Year" value={order.watch_details?.year?.toString() || '—'} />
              <SpecRow label="Movement" value={order.watch_details?.movement || '—'} />
              <SpecRow label="Case material" value={order.watch_details?.case_material || '—'} />
              <SpecRow label="Bracelet material" value={order.watch_details?.bracelet_material || '—'} />
              <SpecRow label="Condition" value={order.condition} hasInfo />
              <SpecRow
                label="Box & Papers"
                value={
                  order.has_box && order.has_papers
                    ? 'Original box and papers'
                    : order.has_box
                    ? 'Box only'
                    : order.has_papers
                    ? 'Papers only'
                    : 'None'
                }
              />
              <SpecRow
                label="Location"
                value={`${getFlagEmoji(order.country_code)} ${order.country_name || order.country_code}`}
              />
              {/* Seller/Buyer Row */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">{order.order_type === 'sell' ? 'Seller' : 'Buyer'}</span>
                <button
                  onClick={() => navigate(`/app/user/${order.user_id}`)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {order.user_profile_image ? (
                      <img src={order.user_profile_image} alt={order.user_name || ''} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                  <span className="text-gray-900 text-sm font-medium">{order.user_name || 'Unknown'}</span>
                  <Star className="w-3.5 h-3.5 text-gray-900 fill-gray-900" />
                  <span className="text-gray-900 text-sm font-medium">
                    {order.user_rating?.toFixed(1) || '0.0'} ({order.user_review_count || 0})
                  </span>
                </button>
              </div>
              <SpecRow label="Price" value={`€${order.price.toLocaleString()}`} />
              <SpecRow label="Availability" value={order.status === 'active' ? 'Item is in stock' : order.status} />
            </div>
          </div>

          {/* Caliber */}
          {order.watch_details?.caliber && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Caliber</h2>
              <div className="space-y-3">
                <SpecRow label="Movement" value={order.watch_details?.movement || '—'} />
                <SpecRow label="Caliber/movement" value={order.watch_details?.caliber || '—'} />
                <SpecRow label="Power reserve" value={order.watch_details?.power_reserve || '—'} />
                <SpecRow label="Number of jewels" value={order.watch_details?.number_of_jewels?.toString() || '—'} />
              </div>
            </div>
          )}

          {/* Case */}
          {order.watch_details?.case_material && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case</h2>
              <div className="space-y-3">
                <SpecRow label="Case material" value={order.watch_details?.case_material || '—'} />
                <SpecRow label="Case diameter" value={order.watch_details?.case_size || '—'} />
                <SpecRow label="Water resistance" value={order.watch_details?.water_resistance || '—'} />
                <SpecRow label="Bezel material" value={order.watch_details?.bezel_material || '—'} />
                <SpecRow label="Crystal" value={order.watch_details?.crystal || '—'} />
                <SpecRow label="Dial" value={order.watch_details?.dial || '—'} />
              </div>
            </div>
          )}

          {/* Bracelet/strap */}
          {order.watch_details?.bracelet_material && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bracelet/strap</h2>
              <div className="space-y-3">
                <SpecRow label="Bracelet material" value={order.watch_details?.bracelet_material || '—'} />
                <SpecRow label="Clasp" value={order.watch_details?.clasp || '—'} />
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Other</h2>
              <div className="space-y-3">
                <SpecRow label="More details" value={order.notes} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Similar Listings */}
      {similarListings.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Similar Listings</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similarListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => navigate(`/app/watch/${listing.reference}`)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="relative mb-3">
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.model} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder size={100} borderRadius={8} />
                    )}
                  </div>
                  <button className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                    <Star className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-500">{listing.brand}</p>
                <p className="font-medium text-gray-900 truncate">{listing.model}</p>
                <p className="text-xs text-gray-400 mb-2">{listing.reference}</p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">€{listing.price.toLocaleString()}</p>
                  {listing.price_change !== undefined && (
                    <span className={`text-xs font-medium ${listing.price_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {listing.price_change >= 0 ? '+' : ''}{listing.price_change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mark as Sold Modal */}
      {showMarkSoldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Mark as Sold</h2>
              <button
                onClick={() => setShowMarkSoldModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark this watch as sold? This action will remove it from your active listings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMarkSoldModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsSold}
                disabled={markingAsSold}
                className="flex-1 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {markingAsSold ? 'Marking...' : 'Mark as Sold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Delete Listing</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this listing? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white font-medium rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Specification row component
function SpecRow({ label, value, hasInfo }: { label: string; value: string; hasInfo?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-900 text-sm font-medium text-right flex items-center gap-1">
        {value}
        {hasInfo && (
          <span className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-xs flex items-center justify-center cursor-help">
            i
          </span>
        )}
      </span>
    </div>
  );
}
