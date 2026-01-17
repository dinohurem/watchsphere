import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useConfig } from '@/hooks/useConfig';

// Form data type
interface ListingFormData {
  // Step 1: Basic Information
  brand: string;
  model: string;
  reference: string;
  year: string;
  size: string;
  movement: string;
  caseMaterial: string;
  braceletMaterial: string;
  condition: string;
  conditionDescription: string;
  boxAndPapers: string;
  location: string;
  price: string;
  currency: string;
  availability: string;

  // Step 2: Caliber Information
  movementType: string;
  caliberMovement: string;
  baseCaliber: string;
  powerReserve: string;
  numberOfJewels: string;

  // Step 3: Bracelet/Strap Information
  braceletColor: string;
  claspType: string;
  claspMaterial: string;

  // Step 4: Photos
  photos: File[];
  photoUrls: string[];
}

const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'caliber', label: 'Caliber Information' },
  { key: 'bracelet', label: 'Bracelet / Strap information' },
  { key: 'photos', label: 'Photos' },
];

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
  const { orderId } = useParams<{ orderId: string }>();
  const { getFieldOptions, isFieldEnabled, isLoading: isLoadingConfig } = useConfig();

  const isEditMode = Boolean(orderId);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(isEditMode);

  const [formData, setFormData] = useState<ListingFormData>({
    // Step 1
    brand: '',
    model: '',
    reference: '',
    year: '',
    size: '',
    movement: '',
    caseMaterial: '',
    braceletMaterial: '',
    condition: '',
    conditionDescription: '',
    boxAndPapers: '',
    location: '',
    price: '',
    currency: 'EUR',
    availability: 'Available',
    // Step 2
    movementType: '',
    caliberMovement: '',
    baseCaliber: '',
    powerReserve: '',
    numberOfJewels: '',
    // Step 3
    braceletColor: '',
    claspType: '',
    claspMaterial: '',
    // Step 4
    photos: [],
    photoUrls: [],
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
        let boxAndPapers = 'Neither';
        if (order.has_box && order.has_papers) {
          boxAndPapers = 'Box and Papers';
        } else if (order.has_box) {
          boxAndPapers = 'Box Only';
        } else if (order.has_papers) {
          boxAndPapers = 'Papers Only';
        }

        // Map order data to form data
        setFormData({
          brand: order.brand || '',
          model: order.model || '',
          reference: order.reference || '',
          year: order.watch_details?.year?.toString() || '',
          size: order.watch_details?.case_size || '',
          movement: order.watch_details?.movement || '',
          caseMaterial: order.watch_details?.case_material || '',
          braceletMaterial: order.watch_details?.bracelet_material || '',
          condition: order.condition || '',
          conditionDescription: order.notes || '',
          boxAndPapers,
          location: order.country_name || '',
          price: order.price?.toLocaleString('de-DE') || '',
          currency: order.currency || 'EUR',
          availability: 'Available',
          // Caliber
          movementType: order.watch_details?.movement || '',
          caliberMovement: order.watch_details?.caliber || '',
          baseCaliber: '',
          powerReserve: order.watch_details?.power_reserve || '',
          numberOfJewels: order.watch_details?.number_of_jewels?.toString() || '',
          // Bracelet
          braceletColor: '',
          claspType: order.watch_details?.clasp || '',
          claspMaterial: '',
          // Photos - use existing image URLs
          photos: [],
          photoUrls: order.watch_details?.images || [],
        });
      } catch (error) {
        console.error('Failed to load order data:', error);
        navigate('/app/inventory');
      } finally {
        setIsLoadingOrder(false);
      }
    };

    loadOrderData();
  }, [orderId, navigate]);

  const updateField = useCallback((field: keyof ListingFormData, value: any) => {
    setFormData((prev) => {
      // If brand changes, reset model
      if (field === 'brand') {
        return { ...prev, [field]: value, model: '' };
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const getModelOptions = useCallback(() => {
    return getFieldOptions('model', formData.brand);
  }, [formData.brand, getFieldOptions]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).slice(0, 10 - formData.photos.length);
    const newUrls = newPhotos.map((file) => URL.createObjectURL(file));

    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos],
      photoUrls: [...prev.photoUrls, ...newUrls],
    }));
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(formData.photoUrls[index]);
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
      photoUrls: prev.photoUrls.filter((_, i) => i !== index),
    }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Upload new photos first (only File objects, not existing URLs)
      const uploadedPhotoUrls: string[] = [];
      for (const photo of formData.photos) {
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
      const existingUrls = formData.photoUrls.filter(url => !url.startsWith('blob:'));
      const allImageUrls = [...existingUrls, ...uploadedPhotoUrls];

      // Prepare listing data
      const priceValue = parseInt(formData.price.replace(/[^0-9]/g, ''), 10) || 0;
      const yearValue = formData.year ? parseInt(formData.year, 10) : undefined;
      const jewelsValue = formData.numberOfJewels ? parseInt(formData.numberOfJewels, 10) : undefined;

      const orderData = {
        order_type: 'sell',
        brand: formData.brand,
        model: formData.model,
        reference: formData.reference,
        price: priceValue,
        currency: formData.currency,
        condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
        country_name: formData.location,
        has_box: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Box Only',
        has_papers: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Papers Only',
        notes: formData.conditionDescription,
        images: allImageUrls,
        // Extended watch details
        year: yearValue,
        size: formData.size || undefined,
        movement: formData.movement || undefined,
        case_material: formData.caseMaterial || undefined,
        bracelet_material: formData.braceletMaterial || undefined,
        availability: formData.availability || undefined,
        // Caliber information
        movement_type: formData.movementType || undefined,
        caliber: formData.caliberMovement || undefined,
        base_caliber: formData.baseCaliber || undefined,
        power_reserve: formData.powerReserve || undefined,
        number_of_jewels: jewelsValue,
        // Bracelet/strap information
        bracelet_color: formData.braceletColor || undefined,
        clasp_type: formData.claspType || undefined,
        clasp_material: formData.claspMaterial || undefined,
      };

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
    // Check if there are any changes
    const hasChanges =
      formData.brand ||
      formData.model ||
      formData.reference ||
      formData.photos.length > 0;

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
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Show loading while config or order data loads
  if (isLoadingConfig || isLoadingOrder) {
    return (
      <div className="p-4 lg:p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

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
                  {isEditMode ? 'Edit listing' : 'Create new listing'}
                </h1>
              </div>
              <div className="flex flex-col">
                {STEPS.map((step, index) => (
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
            {/* Step 0: Basics */}
            {currentStep === 0 && (
              <div className="flex flex-col gap-6">
                <SelectField
                  label="Brand"
                  value={formData.brand}
                  placeholder="Select..."
                  options={getFieldOptions('brand')}
                  onChange={(v) => updateField('brand', v)}
                />

                <SelectField
                  label="Model"
                  value={formData.model}
                  placeholder="Select..."
                  options={getModelOptions()}
                  onChange={(v) => updateField('model', v)}
                  disabled={!formData.brand}
                />

                {isFieldEnabled('reference') && (
                  <TextField
                    label="Reference"
                    value={formData.reference}
                    placeholder="e.g., 126610LN"
                    onChange={(v) => updateField('reference', v)}
                  />
                )}

                {isFieldEnabled('year') && (
                  <SelectField
                    label="Year"
                    value={formData.year}
                    placeholder="Select..."
                    options={getFieldOptions('year')}
                    onChange={(v) => updateField('year', v)}
                  />
                )}

                {isFieldEnabled('size') && (
                  <TextField
                    label="Size"
                    value={formData.size}
                    placeholder="e.g. 41"
                    onChange={(v) => updateField('size', v)}
                    suffix="mm"
                  />
                )}

                {isFieldEnabled('movement') && (
                  <SelectField
                    label="Movement"
                    value={formData.movement}
                    placeholder="Select..."
                    options={getFieldOptions('movement')}
                    onChange={(v) => updateField('movement', v)}
                  />
                )}

                {isFieldEnabled('case_material') && (
                  <SelectField
                    label="Case Material"
                    value={formData.caseMaterial}
                    placeholder="Select..."
                    options={getFieldOptions('case_material')}
                    onChange={(v) => updateField('caseMaterial', v)}
                  />
                )}

                {isFieldEnabled('bracelet_material') && (
                  <SelectField
                    label="Bracelet material"
                    value={formData.braceletMaterial}
                    placeholder="Select..."
                    options={getFieldOptions('bracelet_material')}
                    onChange={(v) => updateField('braceletMaterial', v)}
                  />
                )}

                {isFieldEnabled('condition') && (
                  <SelectField
                    label="Condition"
                    value={formData.condition}
                    placeholder="Select..."
                    options={getFieldOptions('condition')}
                    onChange={(v) => updateField('condition', v)}
                  />
                )}

                {isFieldEnabled('condition_description') && (
                  <TextField
                    label="Condition description"
                    value={formData.conditionDescription}
                    placeholder="Write a short description..."
                    onChange={(v) => updateField('conditionDescription', v)}
                    multiline
                  />
                )}

                {isFieldEnabled('box_papers') && (
                  <SelectField
                    label="Box and papers"
                    value={formData.boxAndPapers}
                    placeholder="Select..."
                    options={getFieldOptions('box_papers')}
                    onChange={(v) => updateField('boxAndPapers', v)}
                  />
                )}

                {isFieldEnabled('location') && (
                  <SelectField
                    label="Location"
                    value={formData.location}
                    placeholder="Select..."
                    options={getFieldOptions('location')}
                    onChange={(v) => updateField('location', v)}
                  />
                )}

                {isFieldEnabled('price') && (
                  <TextField
                    label="Price"
                    value={formData.price}
                    placeholder="e.g., 12,450"
                    onChange={(v) => updateField('price', formatPriceInput(v))}
                  />
                )}

                {isFieldEnabled('currency') && (
                  <SelectField
                    label="Currency"
                    value={formData.currency}
                    placeholder="Select..."
                    options={getFieldOptions('currency')}
                    onChange={(v) => updateField('currency', v)}
                  />
                )}

                {isFieldEnabled('availability') && (
                  <SelectField
                    label="Availability"
                    value={formData.availability}
                    placeholder="Select..."
                    options={getFieldOptions('availability')}
                    onChange={(v) => updateField('availability', v)}
                  />
                )}
              </div>
            )}

            {/* Step 1: Caliber Information */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-6">
                {isFieldEnabled('movement_type') && (
                  <SelectField
                    label="Movement"
                    value={formData.movementType}
                    placeholder="Select type of movement"
                    options={getFieldOptions('movement_type')}
                    onChange={(v) => updateField('movementType', v)}
                  />
                )}

                {isFieldEnabled('caliber') && (
                  <TextField
                    label="Caliber/movement"
                    value={formData.caliberMovement}
                    placeholder="e.g. 3235"
                    onChange={(v) => updateField('caliberMovement', v)}
                  />
                )}

                {isFieldEnabled('base_caliber') && (
                  <TextField
                    label="Base Caliber"
                    value={formData.baseCaliber}
                    placeholder="e.g., 3235"
                    onChange={(v) => updateField('baseCaliber', v)}
                  />
                )}

                {isFieldEnabled('power_reserve') && (
                  <TextField
                    label="Power reserve"
                    value={formData.powerReserve}
                    placeholder="e.g. 70h"
                    onChange={(v) => updateField('powerReserve', v)}
                  />
                )}

                {isFieldEnabled('number_of_jewels') && (
                  <TextField
                    label="Number of jewels"
                    value={formData.numberOfJewels}
                    placeholder="e.g. 20"
                    onChange={(v) => updateField('numberOfJewels', v)}
                  />
                )}
              </div>
            )}

            {/* Step 2: Bracelet / Strap Information */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-6">
                {isFieldEnabled('bracelet_color') && (
                  <SelectField
                    label="Bracelet color"
                    value={formData.braceletColor}
                    placeholder="Type in bracelet color"
                    options={getFieldOptions('bracelet_color')}
                    onChange={(v) => updateField('braceletColor', v)}
                  />
                )}

                {isFieldEnabled('clasp_type') && (
                  <SelectField
                    label="Clasp"
                    value={formData.claspType}
                    placeholder="Select clasp type"
                    options={getFieldOptions('clasp_type')}
                    onChange={(v) => updateField('claspType', v)}
                  />
                )}

                {isFieldEnabled('clasp_material') && (
                  <SelectField
                    label="Clasp material"
                    value={formData.claspMaterial}
                    placeholder="Select clasp material"
                    options={getFieldOptions('clasp_material')}
                    onChange={(v) => updateField('claspMaterial', v)}
                  />
                )}
              </div>
            )}

            {/* Step 3: Photos */}
            {currentStep === 3 && (
              <div>
                {formData.photoUrls.length === 0 ? (
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
                    {formData.photoUrls.map((url, index) => (
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

                    {formData.photoUrls.length < 10 && (
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
              disabled={isSubmitting}
              className={`min-w-[100px] px-4 h-11 rounded-full font-semibold text-[16px] tracking-[0.08px] transition-colors ${
                currentStep === STEPS.length - 1 && formData.photoUrls.length === 0
                  ? 'bg-[#ddd] text-[#212121] cursor-not-allowed'
                  : 'bg-[#ddd] text-[#212121] hover:bg-gray-300'
              }`}
            >
              {isSubmitting
                ? '...'
                : currentStep === STEPS.length - 1
                  ? isEditMode
                    ? 'Update Listing'
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
