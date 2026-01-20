import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronDown, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useConfig, type ListingField, type FieldCategory, CATEGORY_STEPS } from '@/hooks/useConfig';

// Navigation state type for pre-populated data
interface NavigationState {
  brand?: string;
  model?: string;
  reference?: string;
  watchId?: string;
  orderType?: 'buy' | 'sell';
  price?: number;
}

// Form data type - dynamic key-value pairs plus special fields
interface ListingFormData {
  // Core fields that are always present
  order_type: 'buy' | 'sell';
  // Dynamic field values keyed by field key
  [key: string]: string | File[] | string[] | 'buy' | 'sell';
  // Special fields for photos
  photos: File[];
  photoUrls: string[];
}

// Dynamic steps based on categories with photos at the end
const FORM_STEPS: { key: FieldCategory | 'photos'; label: string }[] = [
  { key: 'basic', label: 'Basics' },
  { key: 'caliber', label: 'Caliber Information' },
  { key: 'case', label: 'Case Information' },
  { key: 'bracelet', label: 'Bracelet / Strap information' },
  { key: 'photos', label: 'Photos' },
];

// Map field keys to form data keys (camelCase conversion)
const fieldKeyToFormKey = (key: string): string => {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Map form data keys back to API keys (snake_case conversion)
const formKeyToApiKey = (key: string): string => {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// Dropdown Select component
function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2.5 tracking-[0.075px]">
        {label}
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full h-11 px-4 bg-white border border-[rgba(29,29,31,0.1)] rounded-xl flex items-center justify-between text-[15px] ${
            value ? 'text-[#1d1d1f]' : 'text-[#1d1d1f]/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span>{value || placeholder}</span>
          <ChevronDown className="w-[18px] h-[18px] text-[#1d1d1f]" />
        </button>
        {isOpen && options.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.label);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-[15px] hover:bg-gray-50 ${
                  value === option.label ? 'font-semibold bg-gray-50' : ''
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Text Input component
function TextField({
  label,
  value,
  placeholder,
  onChange,
  suffix,
  multiline,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  suffix?: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <div>
        <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2.5 tracking-[0.075px]">
          {label}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-[150px] px-4 py-3.5 bg-white border border-[rgba(29,29,31,0.1)] rounded-2xl text-[15px] text-[#1d1d1f] placeholder:text-[#1d1d1f]/50 resize-none outline-none focus:border-[#1d1d1f]/30"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[15px] font-semibold text-[#1d1d1f] mb-2.5 tracking-[0.075px]">
        {label}
      </label>
      <div className="flex h-11 bg-white border border-[rgba(29,29,31,0.1)] rounded-xl overflow-hidden">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 text-[15px] text-[#1d1d1f] placeholder:text-[#1d1d1f]/50 outline-none"
        />
        {suffix && (
          <div className="flex items-center justify-center px-3.5 border-l border-[#e8e8e9] text-[15px] text-[#1d1d1f]">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

// Discard Changes Modal
function DiscardModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="text-[15px] text-[#1d1d1f]">Discard changes</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f5] flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2">
            Are you sure you want to cancel?
          </h2>
          <p className="text-[15px] text-[#1d1d1f]/50">
            Any unsaved changes will be lost.
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={onConfirm}
            className="w-full h-11 bg-[#1d1d1f] text-white font-semibold rounded-full hover:bg-black transition-colors"
          >
            Yes, cancel
          </button>
          <button
            onClick={onClose}
            className="w-full h-11 text-[#1d1d1f] font-semibold"
          >
            Continue editing
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateListingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams<{ orderId: string }>();
  const { getFieldOptions, getFieldsByCategory, listingFields, isLoading: isLoadingConfig } = useConfig();

  // Get navigation state for pre-populated data
  const navState = location.state as NavigationState | null;

  const isEditMode = Boolean(orderId);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(isEditMode);

  // Initialize form data with navigation state or empty values
  const [formData, setFormData] = useState<ListingFormData>(() => {
    const initialData: ListingFormData = {
      order_type: navState?.orderType || 'sell',
      photos: [],
      photoUrls: [],
    };

    // Pre-populate from navigation state if available
    if (navState) {
      if (navState.brand) initialData.brand = navState.brand;
      if (navState.model) initialData.model = navState.model;
      if (navState.reference) initialData.reference = navState.reference;
      // Store price as formatted string with thousand separators (de-DE uses . as separator)
      if (navState.price) initialData.price = Math.round(navState.price).toLocaleString('de-DE');
    }

    return initialData;
  });

  // Load existing order data in edit mode
  useEffect(() => {
    const loadOrderData = async () => {
      if (!orderId) return;

      try {
        setIsLoadingOrder(true);
        const response = await api.get(`/orders/${orderId}`);
        const order = response.data;

        // Determine box and papers value
        let boxPapers = '';
        if (order.has_box && order.has_papers) {
          boxPapers = 'Box and Papers';
        } else if (order.has_box) {
          boxPapers = 'Box Only';
        } else if (order.has_papers) {
          boxPapers = 'Papers Only';
        }

        // Map order data to form data dynamically
        const loadedData: ListingFormData = {
          order_type: order.order_type || 'sell',
          photos: [],
          photoUrls: order.watch_details?.images || order.images || [],
          // Core fields
          brand: order.brand || '',
          model: order.model || '',
          reference: order.reference || '',
          price: order.price?.toLocaleString('de-DE') || '',
          currency: order.currency || 'EUR',
          condition: order.condition || '',
          condition_description: order.notes || '',
          box_papers: boxPapers,
          location: order.country_name || '',
        };

        // Load all watch_details fields dynamically
        if (order.watch_details) {
          Object.entries(order.watch_details).forEach(([key, value]) => {
            if (value !== null && value !== undefined && key !== 'images') {
              loadedData[key] = String(value);
            }
          });
        }

        // Also load direct order fields that might be extended fields
        const extendedFields = ['year', 'size', 'movement', 'case_material', 'bracelet_material',
          'movement_type', 'caliber', 'base_caliber', 'power_reserve', 'number_of_jewels',
          'case_diameter', 'water_resistance', 'bezel_material', 'crystal', 'dial', 'dial_numerals',
          'bracelet_color', 'clasp_type', 'clasp_material', 'gender', 'availability'];

        extendedFields.forEach(field => {
          if (order[field] !== null && order[field] !== undefined) {
            loadedData[field] = String(order[field]);
          }
        });

        setFormData(loadedData);
      } catch (error) {
        console.error('Failed to load order data:', error);
        navigate('/app/inventory');
      } finally {
        setIsLoadingOrder(false);
      }
    };

    loadOrderData();
  }, [orderId, navigate]);

  // Update field value - uses field key directly
  const updateField = useCallback((fieldKey: string, value: any) => {
    setFormData((prev) => {
      // If brand changes, reset model
      if (fieldKey === 'brand') {
        return { ...prev, [fieldKey]: value, model: '' };
      }
      return { ...prev, [fieldKey]: value };
    });
  }, []);

  // Get options for a field, handling parent dependencies
  const getOptionsForField = useCallback((field: ListingField) => {
    // Handle parent field dependencies (e.g., model depends on brand)
    if (field.parent_field_key) {
      const parentValue = formData[field.parent_field_key] as string;
      return getFieldOptions(field.key, parentValue);
    }
    return getFieldOptions(field.key);
  }, [formData, getFieldOptions]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const currentPhotos = (formData.photos || []) as File[];
    const currentUrls = (formData.photoUrls || []) as string[];
    const newPhotos = Array.from(files).slice(0, 10 - currentPhotos.length);
    const newUrls = newPhotos.map((file) => URL.createObjectURL(file));

    setFormData((prev) => ({
      ...prev,
      photos: [...currentPhotos, ...newPhotos],
      photoUrls: [...currentUrls, ...newUrls],
    }));
  };

  const removePhoto = (index: number) => {
    const currentUrls = (formData.photoUrls || []) as string[];
    const currentPhotos = (formData.photos || []) as File[];
    URL.revokeObjectURL(currentUrls[index]);
    setFormData((prev) => ({
      ...prev,
      photos: currentPhotos.filter((_, i) => i !== index),
      photoUrls: currentUrls.filter((_, i) => i !== index),
    }));
  };

  const handleNext = () => {
    if (currentStep < FORM_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const yearStr = (formData.year as string) || '';
    const yearValue = yearStr ? parseInt(yearStr, 10) : null;
    if (!yearValue || isNaN(yearValue)) {
      alert('Year is required for all orders');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentPhotos = (formData.photos || []) as File[];
      const currentUrls = (formData.photoUrls || []) as string[];

      // Upload new photos first (only File objects, not existing URLs)
      const uploadedPhotoUrls: string[] = [];
      for (const photo of currentPhotos) {
        const formDataFile = new FormData();
        formDataFile.append('file', photo);

        const uploadResponse = await api.post('/upload/watch', formDataFile, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadResponse.data?.url) {
          uploadedPhotoUrls.push(uploadResponse.data.url);
        }
      }

      // Combine existing URLs (that weren't removed) with newly uploaded ones
      // Filter out any blob URLs from photoUrls (those are for new files only)
      const existingUrls = currentUrls.filter(url => !url.startsWith('blob:'));
      const allImageUrls = [...existingUrls, ...uploadedPhotoUrls];

      // Parse numeric fields - ensure we handle both string and number inputs
      const priceRaw = formData.price;
      let priceValue = 0;
      if (typeof priceRaw === 'number') {
        priceValue = Math.round(priceRaw);
      } else if (typeof priceRaw === 'string') {
        // Remove all non-digit characters (periods, commas, spaces used as thousand separators)
        const digitsOnly = priceRaw.replace(/[^0-9]/g, '');
        priceValue = parseInt(digitsOnly, 10) || 0;
      }
      console.log('Price parsing:', { priceRaw, priceValue });
      const jewelsStr = (formData.number_of_jewels as string) || '';
      const jewelsValue = jewelsStr ? parseInt(jewelsStr, 10) : undefined;

      // Handle box_papers field
      const boxPapers = (formData.box_papers as string) || '';

      // Build order data dynamically from all listing fields
      const orderData: Record<string, any> = {
        order_type: formData.order_type || 'sell',
        brand: formData.brand || '',
        model: formData.model || '',
        reference: formData.reference || '',
        price: priceValue,
        currency: formData.currency || 'EUR',
        condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
        country_name: formData.location || '',
        has_box: boxPapers === 'Box and Papers' || boxPapers === 'Box Only',
        has_papers: boxPapers === 'Box and Papers' || boxPapers === 'Papers Only',
        notes: formData.condition_description || '',
        images: allImageUrls,
      };

      // Add all enabled listing fields dynamically
      // Skip fields already handled above (price, currency, condition, etc.)
      const handledFields = ['price', 'currency', 'condition', 'condition_description', 'box_papers', 'location', 'brand', 'model', 'reference'];
      listingFields.forEach(field => {
        if (handledFields.includes(field.key)) return; // Skip already-handled fields
        const value = formData[field.key];
        if (value !== undefined && value !== null && value !== '') {
          // Handle numeric fields - strip non-digits first (like price formatting)
          if (field.field_type === 'number') {
            const digitsOnly = String(value).replace(/[^0-9]/g, '');
            const numVal = parseInt(digitsOnly, 10);
            if (!isNaN(numVal)) {
              orderData[field.key] = numVal;
            }
          } else {
            orderData[field.key] = value;
          }
        }
      });

      // Ensure specific numeric conversions
      if (yearValue) orderData.year = yearValue;
      if (jewelsValue) orderData.number_of_jewels = jewelsValue;

      if (isEditMode && orderId) {
        // Update existing order
        await api.patch(`/orders/${orderId}`, orderData);
      } else {
        // Create new order
        await api.post('/orders', orderData);
      }

      navigate('/app/inventory');
    } catch (error) {
      console.error('Error saving listing:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    const currentPhotos = (formData.photos || []) as File[];
    // Check if there are any changes
    const hasChanges =
      formData.brand ||
      formData.model ||
      formData.reference ||
      currentPhotos.length > 0;

    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      navigate('/app/inventory');
    }
  };

  const formatPriceInput = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue) {
      return parseInt(numericValue, 10).toLocaleString('de-DE');
    }
    return '';
  };

  // Calculate progress
  const progress = ((currentStep + 1) / FORM_STEPS.length) * 100;

  // Helper to render a dynamic field based on its type
  const renderField = (field: ListingField) => {
    const value = (formData[field.key] as string) || '';
    const options = getOptionsForField(field);
    const isDisabled = field.parent_field_key ? !formData[field.parent_field_key] : false;

    // Handle special case for price formatting
    const handleChange = (newValue: string) => {
      if (field.key === 'price') {
        updateField(field.key, formatPriceInput(newValue));
      } else {
        updateField(field.key, newValue);
      }
    };

    switch (field.field_type) {
      case 'dropdown':
      case 'multi_select':
        return (
          <SelectField
            key={field.key}
            label={field.name}
            value={value}
            placeholder={field.placeholder || `Select ${field.name.toLowerCase()}...`}
            options={options}
            onChange={(v) => updateField(field.key, v)}
            disabled={isDisabled}
          />
        );

      case 'textarea':
        return (
          <TextField
            key={field.key}
            label={field.name}
            value={value}
            placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}...`}
            onChange={handleChange}
            multiline
          />
        );

      case 'number':
      case 'text':
      default:
        return (
          <TextField
            key={field.key}
            label={field.name}
            value={value}
            placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}...`}
            onChange={handleChange}
            suffix={field.key === 'size' || field.key === 'case_diameter' ? 'mm' : undefined}
          />
        );
    }
  };

  // Get fields for current category step
  const getCurrentStepFields = () => {
    const currentStepKey = FORM_STEPS[currentStep]?.key;
    if (!currentStepKey || currentStepKey === 'photos') return [];
    return getFieldsByCategory(currentStepKey as FieldCategory);
  };

  // Show loading while config or order data loads
  if (isLoadingConfig || isLoadingOrder) {
    return (
      <div className="p-4 lg:p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const currentUrls = (formData.photoUrls || []) as string[];

  return (
    <div className="bg-white h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-0">
        <div className="max-w-[894px] mx-auto pb-8">
          {/* Content Area */}
          <div className="flex gap-20">
            {/* Left Sidebar - Steps */}
            <div className="w-[300px] flex-shrink-0 sticky top-6 self-start">
              {/* Header - aligned with steps */}
              <div className="pt-8 pb-6">
                <h1 className="text-2xl font-semibold text-[#1d1d1f]/80">
                  {isEditMode ? 'Edit listing' : `Create new ${formData.order_type === 'buy' ? 'buy order' : 'listing'}`}
                </h1>
              </div>
              <div className="flex flex-col">
                {FORM_STEPS.map((step, index) => (
                  <button
                    key={step.key}
                    onClick={() => setCurrentStep(index)}
                    className={`h-12 px-4 rounded-2xl flex items-center text-left transition-colors ${
                      currentStep === index
                        ? 'bg-[#F7F7F7]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-[15px] font-semibold text-[#1d1d1f] truncate">
                      {step.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 min-w-0 max-w-[514px] pt-[72px]">
              {/* Dynamic Category Steps (0-3) */}
              {currentStep < FORM_STEPS.length - 1 && (
                <div className="flex flex-col gap-6">
                  {getCurrentStepFields().map((field) => renderField(field))}
                  {getCurrentStepFields().length === 0 && (
                    <p className="text-[15px] text-[#1d1d1f]/50">
                      No fields configured for this section.
                    </p>
                  )}
                </div>
              )}

              {/* Photos Step (last step) */}
              {currentStep === FORM_STEPS.length - 1 && (
                <div>
                  {currentUrls.length === 0 ? (
                    <>
                      {/* Upload Area */}
                      <label className="flex flex-col items-center justify-center border border-dashed border-[rgba(29,29,31,0.1)] rounded-2xl py-16 cursor-pointer hover:bg-gray-50 transition-colors">
                        <ImageIcon className="w-12 h-12 text-[#1d1d1f] mb-4" />
                        <p className="text-[15px] text-[#1d1d1f]">
                          Drag & drop or click to <span className="underline">upload photos</span>
                        </p>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Requirements */}
                      <div className="mt-6">
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">
                          Your photos must have
                        </h3>
                        <ul className="space-y-2 text-[15px] text-[#1d1d1f]">
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>A clear, well-lit view of the watch</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>Close-up of the dial, case, and bracelet</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>Real condition, filters and editing should be avoided</span>
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    /* Photo Grid */
                    <div className="grid grid-cols-2 gap-3">
                      {currentUrls.map((url, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-xl overflow-hidden"
                        >
                          <img
                            src={url}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-[#1d1d1f]" />
                          </button>
                        </div>
                      ))}

                      {currentUrls.length < 10 && (
                        <label className="aspect-square rounded-xl border border-dashed border-[rgba(29,29,31,0.1)] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                          <ImageIcon className="w-8 h-8 text-[#1d1d1f]/50 mb-2" />
                          <p className="text-[13px] text-[#1d1d1f]/50 text-center px-4">
                            Drag & drop or click to <span className="underline">upload photos</span> additional photos
                          </p>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Sticky at bottom */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 lg:px-6 pt-6 pb-8">
        <div className="max-w-[894px] mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="text-[16px] font-semibold text-black tracking-[0.08px]"
            >
              Cancel
            </button>

            {/* Progress Bar */}
            <div className="w-[514px] h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1d1d1f] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <button
              onClick={handleNext}
              disabled={isSubmitting || (currentStep === FORM_STEPS.length - 1 && currentUrls.length === 0 && formData.order_type !== 'buy')}
              className={`min-w-[100px] px-4 h-11 rounded-full font-semibold text-[16px] tracking-[0.08px] transition-colors ${
                currentStep === FORM_STEPS.length - 1 && currentUrls.length === 0 && formData.order_type !== 'buy'
                  ? 'bg-[#ddd] text-[#212121] cursor-not-allowed'
                  : 'bg-[#ddd] text-[#212121] hover:bg-gray-300'
              }`}
            >
              {isSubmitting
                ? '...'
                : currentStep === FORM_STEPS.length - 1
                  ? isEditMode
                    ? 'Update Listing'
                    : formData.order_type === 'buy'
                      ? 'Create Buy Order'
                      : 'Create Listing'
                  : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Discard Modal */}
      <DiscardModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={() => navigate('/app/inventory')}
      />
    </div>
  );
}
