import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  MoreVertical,
  X,
  User,
  MessageCircle
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@watchsphere/shared/stores';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import { useConfig, type FieldCategory } from '@/hooks/useConfig';

// Category configuration for display
const CATEGORY_CONFIG: { key: FieldCategory; title: string }[] = [
  { key: 'basic', title: 'Basic info' },
  { key: 'caliber', title: 'Caliber' },
  { key: 'case', title: 'Case' },
  { key: 'bracelet', title: 'Bracelet/strap' },
];

// Edit icon matching Figma design
function EditIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M14.1665 2.5C14.3854 2.28113 14.6452 2.10752 14.9312 1.98906C15.2171 1.87061 15.5236 1.80957 15.8332 1.80957C16.1427 1.80957 16.4492 1.87061 16.7352 1.98906C17.0211 2.10752 17.281 2.28113 17.4998 2.5C17.7187 2.71887 17.8923 2.97871 18.0108 3.26468C18.1292 3.55064 18.1903 3.85714 18.1903 4.16667C18.1903 4.47619 18.1292 4.78269 18.0108 5.06866C17.8923 5.35462 17.7187 5.61446 17.4998 5.83333L6.24984 17.0833L1.6665 18.3333L2.9165 13.75L14.1665 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Checkbox icon for Mark as sold
function CheckboxIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Trash icon for Delete
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M2.5 5H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.66667 5V3.33333C6.66667 2.89131 6.84226 2.46738 7.15482 2.15482C7.46738 1.84226 7.89131 1.66667 8.33333 1.66667H11.6667C12.1087 1.66667 12.5326 1.84226 12.8452 2.15482C13.1577 2.46738 13.3333 2.89131 13.3333 3.33333V5M15.8333 5V16.6667C15.8333 17.1087 15.6577 17.5326 15.3452 17.8452C15.0326 18.1577 14.6087 18.3333 14.1667 18.3333H5.83333C5.39131 18.3333 4.96738 18.1577 4.65482 17.8452C4.34226 17.5326 4.16667 17.1087 4.16667 16.6667V5H15.8333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface WatchDetails {
  image_url?: string;
  images?: string[];
  // Basic information
  year?: number;
  size?: string;
  movement?: string;
  case_material?: string;
  bracelet_material?: string;
  case_size?: string;
  gender?: string;
  availability?: string;
  // Caliber information
  movement_type?: string;
  caliber?: string;
  base_caliber?: string;
  power_reserve?: string;
  number_of_jewels?: number;
  // Case information
  case_diameter?: string;
  water_resistance?: string;
  bezel_material?: string;
  crystal?: string;
  dial?: string;
  dial_numerals?: string;
  // Bracelet/strap information
  bracelet_color?: string;
  clasp_type?: string;
  clasp_material?: string;
  clasp?: string;
  // Allow dynamic keys for any other fields
  [key: string]: string | number | string[] | undefined;
}

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
  watch_details?: WatchDetails;
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getFieldsByCategory } = useConfig();
  const menuRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  // Mark as sold state
  const [showMarkSoldModal, setShowMarkSoldModal] = useState(false);
  const [showSaleComplete, setShowSaleComplete] = useState(false);
  const [markingAsSold, setMarkingAsSold] = useState(false);

  // Mark as completed state (for buy orders)
  const [showMarkCompletedModal, setShowMarkCompletedModal] = useState(false);
  const [showPurchaseComplete, setShowPurchaseComplete] = useState(false);
  const [markingAsCompleted, setMarkingAsCompleted] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnOrder = user?.id === order?.user_id;

  // Get field value from order/watch_details dynamically
  const getFieldValue = (fieldKey: string): string | undefined => {
    if (!order) return undefined;

    // Check watch_details first
    if (order.watch_details && order.watch_details[fieldKey] !== undefined) {
      const val = order.watch_details[fieldKey];
      if (val === null || val === undefined || val === '') return undefined;
      return String(val);
    }

    // Check top-level order properties
    const orderAny = order as unknown as Record<string, unknown>;
    if (orderAny[fieldKey] !== undefined) {
      const val = orderAny[fieldKey];
      if (val === null || val === undefined || val === '') return undefined;
      return String(val);
    }

    return undefined;
  };

  // Render dynamic specs for a category
  const renderCategorySpecs = (category: FieldCategory) => {
    const fields = getFieldsByCategory(category);
    const specsWithValues: { label: string; value: string }[] = [];

    fields.forEach(field => {
      const value = getFieldValue(field.key);
      if (value) {
        specsWithValues.push({ label: field.name, value });
      }
    });

    // Add special fields that aren't in listing fields config
    if (category === 'basic') {
      // Add core order fields
      if (order?.brand) specsWithValues.unshift({ label: 'Brand', value: order.brand });
      if (order?.model) specsWithValues.splice(1, 0, { label: 'Model', value: order.model });
      if (order?.reference) specsWithValues.splice(2, 0, { label: 'Reference', value: order.reference });

      // Add box & papers
      const boxPapers = order?.has_box && order?.has_papers
        ? 'Original box and papers'
        : order?.has_box
        ? 'Box only'
        : order?.has_papers
        ? 'Papers only'
        : undefined;
      if (boxPapers) specsWithValues.push({ label: 'Box & Papers', value: boxPapers });

      // Add location
      if (order?.country_name || order?.country_code) {
        specsWithValues.push({
          label: 'Location',
          value: `${getFlagEmoji(order.country_code)} ${order.country_name || order.country_code}`
        });
      }

      // Add price
      if (order?.price) {
        specsWithValues.push({ label: 'Price', value: `€${order.price.toLocaleString()}` });
      }
    }

    return specsWithValues;
  };

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

  const handleMarkAsCompleted = async () => {
    if (!orderId) return;

    setMarkingAsCompleted(true);
    try {
      await api.post(`/orders/${orderId}/mark-completed`);
      setShowMarkCompletedModal(false);
      setShowPurchaseComplete(true);
    } catch (error) {
      console.error('Failed to mark as completed:', error);
    } finally {
      setMarkingAsCompleted(false);
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
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto py-8 text-center">
          <p className="text-gray-500">Order not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Sale completed screen - matching Figma design
  if (showSaleComplete) {
    return (
      <div className="bg-[#fafafa] min-h-screen relative">
        {/* Top border line */}
        <div className="absolute top-[136px] left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[1px] bg-[rgba(0,0,0,0.1)]" />

        {/* Content */}
        <div className="flex flex-col items-center justify-center min-h-screen px-[68px] py-0">
          {/* Blue check icon */}
          <div className="w-16 h-16 bg-[rgba(0,136,255,0.1)] rounded-full flex items-center justify-center mb-10">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M26.6667 8L12 22.6667L5.33333 16" stroke="#0088FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Text content */}
          <div className="flex flex-col gap-4 items-center text-center max-w-[514px] mb-10">
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
              Sale completed
            </h1>
            <p className="text-[18px] font-normal text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
              Your watch has been marked as sold. Thank you for keeping your inventory up to date.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-6 items-start w-[404px]">
            <button
              onClick={() => navigate('/app/inventory')}
              className="flex-1 h-[48px] bg-[#212121] text-white text-[15px] font-semibold tracking-[0.075px] leading-[20px] rounded-full hover:bg-black transition-colors"
            >
              Go to Inventory
            </button>
            <button
              onClick={() => navigate('/app')}
              className="flex-1 h-[44px] text-[#1d1d1f] text-[15px] font-semibold tracking-[0.075px] leading-[20px] hover:opacity-70 transition-opacity flex items-center justify-center"
            >
              Back to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Purchase completed screen - for buy orders
  if (showPurchaseComplete) {
    return (
      <div className="bg-[#fafafa] min-h-screen relative">
        {/* Top border line */}
        <div className="absolute top-[136px] left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[1px] bg-[rgba(0,0,0,0.1)]" />

        {/* Content */}
        <div className="flex flex-col items-center justify-center min-h-screen px-[68px] py-0">
          {/* Green check icon */}
          <div className="w-16 h-16 bg-[rgba(74,160,120,0.1)] rounded-full flex items-center justify-center mb-10">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M26.6667 8L12 22.6667L5.33333 16" stroke="#4AA078" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Text content */}
          <div className="flex flex-col gap-4 items-center text-center max-w-[514px] mb-10">
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-[0.4px] leading-normal">
              Purchase completed
            </h1>
            <p className="text-[18px] font-normal text-[rgba(29,29,31,0.6)] tracking-[0.1px] leading-[22px]">
              Your buy order has been marked as completed. It has been removed from the order book.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-6 items-start w-[404px]">
            <button
              onClick={() => navigate('/app/profile')}
              className="flex-1 h-[48px] bg-[#212121] text-white text-[15px] font-semibold tracking-[0.075px] leading-[20px] rounded-full hover:bg-black transition-colors"
            >
              Go to Profile
            </button>
            <button
              onClick={() => navigate('/app')}
              className="flex-1 h-[44px] text-[#1d1d1f] text-[15px] font-semibold tracking-[0.075px] leading-[20px] hover:opacity-70 transition-opacity flex items-center justify-center"
            >
              Back to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const images = order.watch_details?.images || [];
  // Use selectedImage from images array if available, otherwise fall back to image_url
  const mainImage = images.length > 0 ? images[selectedImage] : order.watch_details?.image_url;

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
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
            {/* Order Type Badge and Status Label */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-block px-3 py-1 rounded-lg text-[13px] font-semibold ${
                order.order_type === 'buy'
                  ? 'bg-[rgba(74,160,120,0.1)] text-[#4AA078]'
                  : 'bg-[rgba(0,136,255,0.1)] text-[#0088FF]'
              }`}>
                {order.order_type === 'buy' ? 'Buy Order' : 'Sell Order'}
              </span>
              {/* Status Label for Sold/Completed orders
                  - Sell orders show "Sold" when status is sold or completed
                  - Buy orders show "Completed" when status is completed or sold (defensive) */}
              {order.order_type === 'sell' && (order.status === 'sold' || order.status === 'completed') && (
                <span className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-[rgba(201,57,39,0.1)] text-[#c93927]">
                  Sold
                </span>
              )}
              {order.order_type === 'buy' && (order.status === 'completed' || order.status === 'sold') && (
                <span className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-[rgba(128,128,128,0.1)] text-[#666666]">
                  Completed
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {order.brand} {order.model}
            </h1>
            <p className="text-sm sm:text-base text-gray-500">{order.reference}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isOwnOrder ? (
            /* Owner sees three-dot menu */
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-11 h-11 rounded-full bg-[rgba(33,33,33,0.1)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.15)] transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-[#1d1d1f]" />
              </button>

              {/* Dropdown Menu - matching Figma design */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-[200px] bg-white rounded-2xl shadow-[0px_8px_32px_rgba(0,0,0,0.12)] py-2 z-50">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/app/inventory/edit/${orderId}`);
                    }}
                    className="w-full px-4 py-3 text-left text-[15px] font-medium text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-3"
                  >
                    <EditIcon className="w-5 h-5 text-[#1d1d1f]" />
                    Edit
                  </button>
                  {/* Show Mark as Sold only for sell orders, Mark as Completed only for buy orders */}
                  {order.order_type === 'sell' && order.status === 'active' && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowMarkSoldModal(true);
                      }}
                      className="w-full px-4 py-3 text-left text-[15px] font-medium text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-3"
                    >
                      <CheckboxIcon className="w-5 h-5 text-[#1d1d1f]" />
                      Mark as sold
                    </button>
                  )}
                  {order.order_type === 'buy' && order.status === 'active' && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowMarkCompletedModal(true);
                      }}
                      className="w-full px-4 py-3 text-left text-[15px] font-medium text-[#1d1d1f] hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-3"
                    >
                      <CheckboxIcon className="w-5 h-5 text-[#1d1d1f]" />
                      Mark as completed
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-4 py-3 text-left text-[15px] font-medium text-[#c93927] hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-3"
                  >
                    <TrashIcon className="w-5 h-5 text-[#c93927]" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Non-owner sees watchlist icon */
            <button
              onClick={toggleWatchlist}
              className="w-11 h-11 rounded-full bg-[rgba(33,33,33,0.1)] flex items-center justify-center hover:bg-[rgba(33,33,33,0.15)] transition-colors"
            >
              <Star
                className={`w-5 h-5 ${isInWatchlist ? 'text-[#1d1d1f] fill-[#1d1d1f]' : 'text-[#1d1d1f]'}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Images & Info */}
        <div className="lg:w-[400px] space-y-4">
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

          {/* Thumbnail Gallery - horizontal scrollable */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 transition-all ${
                    selectedImage === idx
                      ? 'ring-2 ring-[#212121] ring-offset-2'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* 4 Info Rows - matching Figma design */}
          <div className="space-y-0">
            {/* Condition Row */}
            <div className="flex items-center justify-between py-[12px] border-b border-[rgba(0,0,0,0.1)]">
              <span className="text-[15px] text-[#1d1d1f] opacity-50">Condition</span>
              <span className="text-[15px] text-[#1d1d1f] font-semibold">{order.condition}</span>
            </div>
            {/* Case Size Row */}
            <div className="flex items-center justify-between py-[12px] border-b border-[rgba(0,0,0,0.1)]">
              <span className="text-[15px] text-[#1d1d1f] opacity-50">Case size</span>
              <span className="text-[15px] text-[#1d1d1f] font-semibold">{order.watch_details?.case_size || '—'}</span>
            </div>
            {/* Box/Papers Row */}
            <div className="flex items-center justify-between py-[12px] border-b border-[rgba(0,0,0,0.1)]">
              <span className="text-[15px] text-[#1d1d1f] opacity-50">Box/papers</span>
              <span className="text-[15px] text-[#1d1d1f] font-semibold">
                {order.has_box && order.has_papers
                  ? 'Box and papers'
                  : order.has_box
                  ? 'Box only'
                  : order.has_papers
                  ? 'Papers only'
                  : 'None'}
              </span>
            </div>
            {/* Location Row */}
            <div className="flex items-center justify-between py-[12px] border-b border-[rgba(0,0,0,0.1)]">
              <span className="text-[15px] text-[#1d1d1f] opacity-50">Location</span>
              <span className="text-[15px] text-[#1d1d1f] font-semibold flex items-center gap-1">
                {getFlagEmoji(order.country_code)} {order.country_name || order.country_code}
              </span>
            </div>
          </div>

          {/* Contact Button - only for non-owners */}
          {!isOwnOrder && (
            <button
              onClick={() => navigate(`/app/chat/${order.user_id}`)}
              className="w-full h-[48px] bg-[#212121] text-white text-[16px] font-semibold tracking-[0.08px] leading-[20px] rounded-full hover:bg-black transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <MessageCircle className="w-5 h-5" />
              Contact
            </button>
          )}
        </div>

        {/* Right Column - Specifications - Dynamic rendering by category */}
        <div className="flex-1 space-y-8">
          {CATEGORY_CONFIG.map(({ key, title }) => {
            const specs = renderCategorySpecs(key);

            // For basic category, always show (it has required fields)
            // For other categories, only show if there are values
            if (key !== 'basic' && specs.length === 0) return null;

            return (
              <div key={key}>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f] mb-4">{title}</h2>
                <div className="space-y-0">
                  {specs.map((spec, idx) => (
                    <SpecRow key={`${key}-${idx}`} label={spec.label} value={spec.value} />
                  ))}

                  {/* Seller/Buyer Row - only in basic section */}
                  {key === 'basic' && (
                    <div className="flex items-start py-[8px] border-b border-[rgba(0,0,0,0.1)]">
                      <span className="w-[168px] shrink-0 text-[15px] text-[#1d1d1f] opacity-50">
                        {order.order_type === 'sell' ? 'Seller' : 'Buyer'}
                      </span>
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
                        <span className="text-[15px] text-[#1d1d1f] font-semibold">{order.user_name || 'Unknown'}</span>
                        <Star className="w-3.5 h-3.5 text-[#1d1d1f] fill-[#1d1d1f]" />
                        <span className="text-[15px] text-[#1d1d1f] font-semibold">
                          {order.user_rating?.toFixed(1) || '0.0'} ({order.user_review_count || 0})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          {order.notes && (
            <div>
              <h2 className="text-[18px] font-semibold text-[#1d1d1f] mb-4">Other</h2>
              <div className="space-y-0">
                <SpecRow label="More details" value={order.notes} />
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Mark as Completed Modal (for buy orders) */}
      {showMarkCompletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Mark as Completed</h2>
              <button
                onClick={() => setShowMarkCompletedModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark this buy order as completed? This action will remove it from the order book.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMarkCompletedModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsCompleted}
                disabled={markingAsCompleted}
                className="flex-1 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {markingAsCompleted ? 'Marking...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Specification row component - matching Figma design
function SpecRow({ label, value, hasInfo }: { label: string; value: string; hasInfo?: boolean }) {
  return (
    <div className="flex items-start py-[8px] border-b border-[rgba(0,0,0,0.1)]">
      <span className="w-[168px] shrink-0 text-[15px] text-[#1d1d1f] opacity-50">{label}</span>
      <span className="text-[15px] text-[#1d1d1f] font-semibold flex items-center gap-1">
        {value}
        {hasInfo && (
          <span className="w-4 h-4 rounded-full border border-[rgba(0,0,0,0.2)] text-[rgba(0,0,0,0.4)] text-xs flex items-center justify-center cursor-help ml-1">
            i
          </span>
        )}
      </span>
    </div>
  );
}
