import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/services/api';
import { useSocialFilters } from '@/hooks/useConfig';
import { SlidersHorizontal, X, MessageSquare, MapPin, Calendar, User } from 'lucide-react';

interface SocialMessage {
  id: string;
  brand: string | null;
  reference: string | null;
  price: number | null;
  currency: string;
  condition: string | null;
  seller_name: string;
  seller_phone: string | null;
  raw_text: string;
  offer_type: string;
  country_code: string | null;
  country_name: string | null;
  message_timestamp: string | null;
}

interface Country {
  code: string;
  name: string;
}

// Social message card component
function SocialMessageCard({ message }: { message: SocialMessage }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOfferTypeBadge = (type: string) => {
    if (type === 'wts') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          WTS
        </span>
      );
    } else if (type === 'wtb') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          WTB
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
        Unknown
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header with offer type and date */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {getOfferTypeBadge(message.offer_type)}
          {message.brand && (
            <span className="text-sm font-medium text-gray-900">{message.brand}</span>
          )}
          {message.reference && (
            <span className="text-sm text-gray-500">• {message.reference}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-400">
          <Calendar className="w-4 h-4" />
          {formatDate(message.message_timestamp)}
        </div>
      </div>

      {/* Message content */}
      <div className="mb-4">
        <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
          {message.raw_text}
        </p>
      </div>

      {/* Footer with contact and location */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          {/* Seller info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{message.seller_name}</p>
              {message.seller_phone && (
                <p className="text-xs text-gray-500">{message.seller_phone}</p>
              )}
            </div>
          </div>

          {/* Location */}
          {message.country_name && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              {message.country_name}
            </div>
          )}
        </div>

        {/* Price if available */}
        {message.price && (
          <p className="text-lg font-bold text-gray-900">
            {message.currency === 'EUR' ? '€' : message.currency === 'USD' ? '$' : message.currency}
            {message.price.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <MessageSquare className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {hasFilters ? 'No messages match your filters' : 'No messages found'}
      </h3>
      <p className="text-gray-500 text-center max-w-md">
        {hasFilters
          ? 'Try adjusting your filters to see more results.'
          : 'Social messages from imported WhatsApp groups will appear here.'}
      </p>
    </div>
  );
}

export function SocialSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Get social filters from config
  const { data: socialFilters = [] } = useSocialFilters();

  // Get countries from dynamic config
  const countries: Country[] = useMemo(() => {
    const countryFilter = socialFilters.find(f => f.key === 'country_code');
    if (countryFilter && countryFilter.values.length > 0) {
      return countryFilter.values
        .filter(v => v.is_enabled)
        .sort((a, b) => a.display_order - b.display_order)
        .map(v => ({ code: v.value, name: v.label }));
    }
    // Fallback if config not loaded yet
    return [
      { code: 'US', name: 'United States' },
      { code: 'UK', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'IT', name: 'Italy' },
      { code: 'FR', name: 'France' },
    ];
  }, [socialFilters]);

  // Get filters from URL params
  const offerType = searchParams.get('offer_type');
  const countryCode = searchParams.get('country_code');
  const reference = searchParams.get('reference');

  useEffect(() => {
    loadMessages();
  }, [searchParams]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (offerType) {
        params.offer_type = offerType;
      }
      if (reference) {
        params.reference = reference;
      }
      if (countryCode) {
        params.country_code = countryCode;
      }

      const response = await api.get('/whatsapp/social/search', { params });
      if (response.data) {
        setMessages(response.data.results || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferTypeChange = (type: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (type) {
      params.set('offer_type', type);
    } else {
      params.delete('offer_type');
    }
    setSearchParams(params);
  };

  const handleRemoveFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params);
  };

  const handleOpenFilters = () => {
    // Build current filter params for the filter page
    const params = new URLSearchParams(searchParams);
    navigate(`/app/social-search/filters${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Count active filters (excluding offer_type since it has quick buttons)
  const activeFilterCount =
    (countryCode ? 1 : 0) +
    (reference ? 1 : 0);

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Social Search</h1>
          <p className="text-gray-500">
            Search through imported WhatsApp messages from watch trading groups
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Quick filter pills */}
              <button
                onClick={() => handleOfferTypeChange(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !offerType
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleOfferTypeChange('wts')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  offerType === 'wts'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                WTS Offers
              </button>
              <button
                onClick={() => handleOfferTypeChange('wtb')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  offerType === 'wtb'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                WTB Offers
              </button>
            </div>

            {/* Filter Button */}
            <button
              onClick={handleOpenFilters}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                activeFilterCount > 0
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm font-medium">
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </span>
            </button>
          </div>

          {/* Active filters display */}
          {(reference || countryCode) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">Active filters:</span>
              {reference && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                  Ref: {reference}
                  <button
                    onClick={() => handleRemoveFilter('reference')}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {countryCode && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                  {countries.find(c => c.code === countryCode)?.name || countryCode}
                  <button
                    onClick={() => handleRemoveFilter('country_code')}
                    className="ml-1 hover:text-gray-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        {!loading && messages.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Showing {messages.length} of {total} messages
            </p>
          </div>
        )}

        {/* Messages List */}
        <div className="space-y-4">
          {loading ? (
            // Loading skeleton
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-6 bg-gray-200 rounded-full" />
                    <div className="w-20 h-5 bg-gray-200 rounded" />
                  </div>
                  <div className="w-32 h-4 bg-gray-200 rounded" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="w-24 h-5 bg-gray-200 rounded" />
                  </div>
                  <div className="w-20 h-6 bg-gray-200 rounded" />
                </div>
              </div>
            ))
          ) : messages.length === 0 ? (
            <EmptyState hasFilters={activeFilterCount > 0} />
          ) : (
            messages.map((message) => (
              <SocialMessageCard key={message.id} message={message} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
