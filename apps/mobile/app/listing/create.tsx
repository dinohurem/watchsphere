import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, Image, Alert, ActivityIndicator, Keyboard, InputAccessoryView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig, ListingField, FieldCategory, CATEGORY_STEPS } from '@/contexts/ConfigContext';
import { configKeyToOrderKey, orderKeyToConfigKey, MANUALLY_HANDLED_FIELDS } from '@/utils/fieldKeyMap';
import { api } from '@/services/api';
import { BackArrow, ChevronDown, ChevronRight, Plus, X, Trash2, Check } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

// Unique ID for the numeric keyboard accessory toolbar (iOS only)
const NUMERIC_KEYBOARD_ACCESSORY_ID = 'numericKeyboardDone';

// Step indicator component
const TOTAL_STEPS = 6;

// Image upload icon
function ImageUploadIcon({ size = 48, color = '#212121' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect x="4" y="8" width="40" height="32" rx="4" stroke={color} strokeWidth="2" />
      <Path d="M4 32L14 22L22 30L30 18L44 32" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 18C15.6569 18 17 16.6569 17 15C17 13.3431 15.6569 12 14 12C12.3431 12 11 13.3431 11 15C11 16.6569 12.3431 18 14 18Z" fill={color} />
    </Svg>
  );
}

// Form data type - dynamic key-value pairs
interface ListingFormData {
  [key: string]: string | string[];
  photos: string[];
}

// Form step configuration
const FORM_STEPS: { key: FieldCategory | 'photos' | 'overview'; label: string }[] = [
  { key: 'basic', label: 'Basic information' },
  { key: 'caliber', label: 'Caliber information' },
  { key: 'case', label: 'Case information' },
  { key: 'bracelet', label: 'Bracelet / Strap information' },
  { key: 'photos', label: 'Photos' },
  { key: 'overview', label: 'Listing overview' },
];

export default function CreateListingScreen() {
  const { t } = useTranslation();
  const { colors, fonts } = useTheme();
  const { getFieldOptions, loadListingFields, isLoadingListingFields, listingFields, error: configError, getFieldsByCategory } = useConfig();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const isConfigReady = listingFields.length > 0;

  // Load listing fields when component mounts
  useEffect(() => {
    loadListingFields();
  }, [loadListingFields]);

  // Timeout to prevent infinite loading if config never loads
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isConfigReady) {
        setLoadingTimedOut(true);
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [isConfigReady]);

  const params = useLocalSearchParams<{
    watchId?: string;
    brand?: string;
    model?: string;
    reference?: string;
    priceMin?: string;
    priceMax?: string;
    // Edit mode params
    editMode?: string;
    orderId?: string;
    orderType?: string;
    price?: string;
    condition?: string;
    country_code?: string;
    country_name?: string;
    has_box?: string;
    has_papers?: string;
  }>();

  // Check if we're in edit mode or creating a buy order
  const isEditMode = params.editMode === 'true';
  const orderId = params.orderId;
  const isBuyOrder = params.orderType === 'buy';
  const isNewBuyOrder = isBuyOrder && !isEditMode;
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(isEditMode);

  // Current step (1-6)
  const [currentStep, setCurrentStep] = useState(1);

  // Helper to get options as string array from config
  const getOptionsForField = useCallback((fieldKey: string, parentValue?: string): string[] => {
    const options = getFieldOptions(fieldKey, parentValue);
    return options.map(opt => opt.label);
  }, [getFieldOptions]);

  // Dropdown modal state
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [dropdownTitle, setDropdownTitle] = useState('');

  // Form data - dynamic, pre-populated if coming from sell order or edit mode
  const [formData, setFormData] = useState<ListingFormData>(() => {
    // Format price with thousand separators if provided
    let priceFormatted = '';
    if (params.price) {
      const priceNum = parseInt(params.price.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(priceNum)) {
        priceFormatted = priceNum.toLocaleString('de-DE');
      }
    }

    const initialData: ListingFormData = {
      photos: [],
      // Pre-populate from params if available (basic info only, full details loaded via API)
      brand: params.brand || '',
      model: params.model || '',
      reference: params.reference || '',
      condition: '',
      box_papers: '',
      location: '',
      price: priceFormatted,
      currency: 'EUR',
    };
    return initialData;
  });

  // Load order details when in edit mode
  useEffect(() => {
    const loadOrderDetails = async () => {
      if (!isEditMode || !orderId) {
        setIsLoadingOrder(false);
        return;
      }

      try {
        setIsLoadingOrder(true);
        const response = await api.get(`/orders/${orderId}`);
        const order = response.data;

        // Determine box and papers value
        let boxPapersValue = '';
        if (order.has_box && order.has_papers) boxPapersValue = 'Box and Papers';
        else if (order.has_box) boxPapersValue = 'Box Only';
        else if (order.has_papers) boxPapersValue = 'Papers Only';

        // Determine condition value
        let conditionValue = '';
        if (order.condition === 'unworn' || order.condition === 'Unworn') conditionValue = 'Unworn';
        else if (order.condition) conditionValue = 'Used';

        // Build form data from order details
        // Core fields set manually, then all watch_details loaded dynamically
        const orderFormData: ListingFormData = {
          brand: order.brand || '',
          model: order.model || '',
          reference: order.reference || '',
          condition: conditionValue,
          box_papers: boxPapersValue,
          location: order.country_name || '',
          price: order.price ? order.price.toLocaleString('de-DE') : '',
          currency: order.currency || 'EUR',
          photos: order.watch_details?.images || [],
          condition_description: order.notes || '',
        };

        // Dynamically load all watch_details fields, remapping order keys to config keys
        if (order.watch_details) {
          Object.entries(order.watch_details).forEach(([key, value]) => {
            if (value !== null && value !== undefined && key !== 'images' && key !== 'image_url') {
              const formKey = orderKeyToConfigKey(key);
              orderFormData[formKey] = String(value);
            }
          });
        }

        setFormData(orderFormData);
      } catch (error) {
        console.error('Failed to load order details:', error);
        Alert.alert(t('common.error'), t('listing.failedToLoadOrder'));
      } finally {
        setIsLoadingOrder(false);
      }
    };

    loadOrderDetails();
  }, [isEditMode, orderId]);

  // Update form field
  const updateField = useCallback((field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Open dropdown
  const openDropdown = useCallback((field: string, options: string[], title: string) => {
    setDropdownField(field);
    setDropdownOptions(options);
    setDropdownTitle(title);
    setShowDropdown(true);
  }, []);

  // Select dropdown option
  const selectOption = useCallback((option: string) => {
    if (dropdownField) {
      updateField(dropdownField, option);
      // If brand is selected, reset model
      if (dropdownField === 'brand') {
        updateField('model', '');
      }
    }
    setShowDropdown(false);
  }, [dropdownField, updateField]);

  // Handle photo pick
  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('listing.permissionNeeded'), t('listing.grantPhotoAccess'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - formData.photos.length,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      updateField('photos', [...formData.photos, ...newPhotos]);
    }
  };

  // Remove photo
  const removePhoto = useCallback((index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateField('photos', newPhotos);
  }, [formData.photos, updateField]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      router.back();
    }
  }, [currentStep]);

  // Helper to get form value as string
  const getFormValue = useCallback((key: string): string => {
    const value = formData[key];
    if (Array.isArray(value)) return '';
    return value || '';
  }, [formData]);

  // Handle save listing (create or update)
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Validate required fields - year is mandatory for all orders
    const yearStr = getFormValue('year');
    const yearValue = yearStr ? parseInt(yearStr, 10) : null;
    if (!yearValue || isNaN(yearValue)) {
      Alert.alert(t('listing.missingField'), t('listing.yearRequired'));
      return;
    }

    setIsSaving(true);

    try {
      // Upload photos first (only new local photos) - skip for buy orders
      const uploadedPhotoUrls: string[] = [];

      if (!isBuyOrder) {
        for (const photoUri of formData.photos) {
          // Skip already uploaded photos (URLs starting with http)
          if (photoUri.startsWith('http')) {
            uploadedPhotoUrls.push(photoUri);
            continue;
          }

          // Create form data for upload
          const formDataFile = new FormData();
          const filename = photoUri.split('/').pop() || 'photo.jpg';
          formDataFile.append('file', {
            uri: photoUri,
            type: 'image/jpeg',
            name: filename,
          } as any);

          const uploadResponse = await api.post('/upload/watch', formDataFile, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (uploadResponse.data?.url) {
            uploadedPhotoUrls.push(uploadResponse.data.url);
          }
        }
      }

      // Create/Update the order/listing
      const priceStr = getFormValue('price');
      const priceValue = parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;

      // Parse year (already validated above)
      const parsedYear = parseInt(getFormValue('year'), 10);

      // Build extended watch details dynamically from all listing fields
      const extendedFields: Record<string, any> = {
        images: uploadedPhotoUrls,
      };

      listingFields.forEach(field => {
        if (MANUALLY_HANDLED_FIELDS.has(field.key)) return;
        const value = formData[field.key];
        if (value !== undefined && value !== null && value !== '') {
          const orderKey = configKeyToOrderKey(field.key);
          if (field.field_type === 'number') {
            const numVal = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numVal)) {
              extendedFields[orderKey] = numVal;
            }
          } else {
            extendedFields[orderKey] = value;
          }
        }
      });

      // Ensure year is always set as a number (already validated above)
      extendedFields.year = parsedYear;

      if (isEditMode && orderId) {
        // Update existing order - send all updatable fields
        const boxPapersValue = getFormValue('box_papers');
        const updateData = {
          price: priceValue,
          condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
          has_box: boxPapersValue === 'Box and Papers' || boxPapersValue === 'Box Only',
          has_papers: boxPapersValue === 'Box and Papers' || boxPapersValue === 'Papers Only',
          notes: formData['condition_description'] || null,
          ...extendedFields,
        };

        console.log('Updating order:', orderId, updateData);
        await api.patch(`/orders/${orderId}`, updateData);
        Alert.alert(t('common.success'), t('listing.orderUpdated'), [
          { text: t('common.ok'), onPress: () => router.back() }
        ]);
      } else {
        // Create new order - send all fields
        const createBoxPapersValue = getFormValue('box_papers');
        const orderData = {
          order_type: isNewBuyOrder ? 'buy' : 'sell',
          brand: formData.brand,
          model: formData.model,
          reference: formData.reference,
          price: priceValue,
          currency: formData.currency,
          condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
          country_code: params.country_code || 'US',
          country_name: formData.location,
          has_box: createBoxPapersValue === 'Box and Papers' || createBoxPapersValue === 'Box Only',
          has_papers: createBoxPapersValue === 'Box and Papers' || createBoxPapersValue === 'Papers Only',
          notes: formData['condition_description'],
          ...extendedFields,
        };

        await api.post('/orders', orderData);
        Alert.alert(t('common.success'), isNewBuyOrder ? t('listing.buyOrderCreated') : t('listing.listingCreated'), [
          { text: t('common.ok'), onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('Error saving listing:', error?.response?.data || error);
      Alert.alert(t('common.error'), error?.response?.data?.detail || t('listing.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  }, [formData, isEditMode, orderId, params.country_code, isBuyOrder, isSaving, getFormValue]);

  // Format price input
  const formatPriceInput = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue) {
      return parseInt(numericValue, 10).toLocaleString('de-DE');
    }
    return '';
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(8),
      paddingVertical: hp(8),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    backButton: {
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      textAlign: 'center',
      marginRight: sp(44), // Balance the back button
    },

    // Progress Indicator (now at bottom)
    progressContainer: {
      flexDirection: 'row',
      gap: wp(2),
      marginBottom: hp(16),
    },
    progressDot: {
      flex: 1,
      height: hp(4),
      borderRadius: sp(999),
      backgroundColor: 'rgba(33, 33, 33, 0.25)',
    },
    progressDotActive: {
      backgroundColor: '#212121',
    },

    // Content
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: wp(16),
      paddingTop: hp(20),
      paddingBottom: hp(120),
    },
    sectionTitle: {
      fontSize: fp(24),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(24),
    },

    // Form Fields
    fieldContainer: {
      marginBottom: hp(24),
    },
    fieldLabel: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(6),
      letterSpacing: 0.075,
    },
    fieldInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: 'rgba(29, 29, 31, 0.1)',
      borderRadius: sp(16),
      paddingHorizontal: wp(16),
      paddingVertical: hp(14),
    },
    fieldInput: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      padding: 0,
    },
    fieldPlaceholder: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      opacity: 0.5,
    },
    fieldValue: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
    },
    textArea: {
      height: hp(150),
      textAlignVertical: 'top',
      paddingTop: hp(14),
    },
    rowFields: {
      flexDirection: 'row',
      gap: wp(10),
    },
    halfField: {
      flex: 1,
    },

    // Photo Upload
    photoUploadContainer: {
      borderWidth: 1,
      borderColor: 'rgba(29, 29, 31, 0.1)',
      borderRadius: sp(16),
      borderStyle: 'dashed',
      paddingVertical: hp(40),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: hp(24),
    },
    photoUploadText: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
      marginTop: hp(16),
    },
    photoUploadTextBold: {
      fontFamily: fonts.semiBold,
    },
    photoRequirements: {
      marginBottom: hp(24),
    },
    photoRequirementsTitle: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(12),
    },
    photoRequirementItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: hp(8),
    },
    photoRequirementBullet: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#1D1D1F',
      marginRight: wp(8),
    },
    photoRequirementText: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#1D1D1F',
    },

    // Photo Grid
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(12),
      marginBottom: hp(24),
    },
    photoItem: {
      width: (wp(343) - wp(12)) / 2,
      aspectRatio: 1,
      borderRadius: sp(12),
      overflow: 'hidden',
      position: 'relative',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoDeleteButton: {
      position: 'absolute',
      top: sp(8),
      right: sp(8),
      width: sp(28),
      height: sp(28),
      borderRadius: sp(14),
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPhotoButton: {
      width: (wp(343) - wp(12)) / 2,
      aspectRatio: 1,
      borderRadius: sp(12),
      backgroundColor: '#F5F5F5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPhotoIcon: {
      width: sp(40),
      height: sp(40),
      borderRadius: sp(20),
      backgroundColor: '#212121',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Listing Overview
    overviewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: hp(16),
      borderWidth: 1,
      borderColor: 'rgba(29, 29, 31, 0.1)',
      borderRadius: sp(12),
      paddingHorizontal: wp(16),
      marginBottom: hp(12),
    },
    overviewItemText: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#1D1D1F',
    },

    // Bottom Buttons
    bottomButtonsContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: wp(25),
      paddingTop: hp(24),
      paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(24),
    },
    continueButton: {
      backgroundColor: '#212121',
      borderRadius: sp(99),
      paddingVertical: hp(12),
      alignItems: 'center',
    },
    continueButtonDisabled: {
      backgroundColor: 'rgba(33, 33, 33, 0.3)',
    },
    continueButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
      letterSpacing: 0.08,
    },

    // Keyboard toolbar (iOS InputAccessoryView)
    keyboardToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#D1D5DB',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#B0B0B0',
    },
    keyboardDoneButton: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    keyboardDoneText: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: '#007AFF',
    },

    // Dropdown Modal
    dropdownOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    dropdownContent: {
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: sp(24),
      borderTopRightRadius: sp(24),
      maxHeight: '70%',
    },
    dropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp(16),
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
      position: 'relative',
    },
    dropdownTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
    },
    dropdownCloseButton: {
      position: 'absolute',
      right: wp(16),
      width: sp(32),
      height: sp(32),
      borderRadius: sp(16),
      backgroundColor: '#F5F5F5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownScrollContent: {
      paddingBottom: Platform.OS === 'ios' ? hp(34) : hp(16),
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: hp(16),
      paddingHorizontal: wp(16),
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    dropdownOptionText: {
      fontSize: fp(16),
      fontFamily: fonts.regular,
      color: '#212121',
    },
    dropdownOptionSelected: {
      fontFamily: fonts.semiBold,
    },
  }), [colors, fonts]);

  // Get options for a field, handling parent-child relationships
  const getOptionsForFieldDynamic = useCallback((field: ListingField): string[] => {
    // Special case: model depends on brand
    if (field.parent_field_key) {
      const parentValue = getFormValue(field.parent_field_key);
      return getOptionsForField(field.key, parentValue);
    }
    return getOptionsForField(field.key);
  }, [getOptionsForField, getFormValue]);

  // Render a single dynamic field based on its type
  const renderDynamicField = useCallback((field: ListingField) => {
    const value = getFormValue(field.key);
    const options = getOptionsForFieldDynamic(field);
    const placeholder = field.placeholder || `Enter ${field.name.toLowerCase()}`;

    // Dropdown field
    if (field.field_type === 'dropdown' || field.field_type === 'multi_select') {
      return (
        <View key={field.key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{field.name}</Text>
          <TouchableOpacity
            style={styles.fieldInputContainer}
            onPress={() => openDropdown(field.key, options, `Select ${field.name}`)}
          >
            {value ? (
              <Text style={styles.fieldValue}>{value}</Text>
            ) : (
              <Text style={styles.fieldPlaceholder}>{placeholder}</Text>
            )}
            <ChevronDown size={sp(18)} color="#1D1D1F" />
          </TouchableOpacity>
        </View>
      );
    }

    // Textarea field
    if (field.field_type === 'textarea') {
      return (
        <View key={field.key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{field.name}</Text>
          <View style={[styles.fieldInputContainer, { alignItems: 'flex-start' }]}>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              value={value}
              onChangeText={(text) => updateField(field.key, text)}
              placeholder={placeholder}
              placeholderTextColor="rgba(29, 29, 31, 0.5)"
              multiline
            />
          </View>
        </View>
      );
    }

    // Number field
    if (field.field_type === 'number') {
      // Special handling for price field
      if (field.key === 'price') {
        return (
          <View key={field.key} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.name}</Text>
            <View style={styles.fieldInputContainer}>
              <TextInput
                style={styles.fieldInput}
                value={value}
                onChangeText={(text) => updateField(field.key, formatPriceInput(text))}
                placeholder={placeholder}
                placeholderTextColor="rgba(29, 29, 31, 0.5)"
                keyboardType="number-pad"
                {...(Platform.OS === 'ios' ? { inputAccessoryViewID: NUMERIC_KEYBOARD_ACCESSORY_ID } : { returnKeyType: 'done', onSubmitEditing: Keyboard.dismiss })}
              />
            </View>
          </View>
        );
      }

      return (
        <View key={field.key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{field.name}</Text>
          <View style={styles.fieldInputContainer}>
            <TextInput
              style={styles.fieldInput}
              value={value}
              onChangeText={(text) => updateField(field.key, text)}
              placeholder={placeholder}
              placeholderTextColor="rgba(29, 29, 31, 0.5)"
              keyboardType="number-pad"
              maxLength={field.key === 'year' ? 4 : undefined}
              {...(Platform.OS === 'ios' ? { inputAccessoryViewID: NUMERIC_KEYBOARD_ACCESSORY_ID } : { returnKeyType: 'done', onSubmitEditing: Keyboard.dismiss })}
            />
          </View>
        </View>
      );
    }

    // Default: text field
    return (
      <View key={field.key} style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{field.name}</Text>
        <View style={styles.fieldInputContainer}>
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={(text) => updateField(field.key, text)}
            placeholder={placeholder}
            placeholderTextColor="rgba(29, 29, 31, 0.5)"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
        </View>
      </View>
    );
  }, [getFormValue, getOptionsForFieldDynamic, openDropdown, updateField, formatPriceInput, styles]);

  // Render fields for a category step
  const renderCategoryFields = useCallback((category: FieldCategory) => {
    const fields = getFieldsByCategory(category);
    return fields.map(field => renderDynamicField(field));
  }, [getFieldsByCategory, renderDynamicField]);

  // Render step content dynamically
  const renderStepContent = () => {
    const stepConfig = FORM_STEPS[currentStep - 1];
    if (!stepConfig) return null;

    // Category steps (1-4)
    if (stepConfig.key === 'basic' || stepConfig.key === 'caliber' || stepConfig.key === 'case' || stepConfig.key === 'bracelet') {
      const categoryConfig = CATEGORY_STEPS[stepConfig.key];
      return (
        <>
          <Text style={styles.sectionTitle}>{categoryConfig.title}</Text>
          {renderCategoryFields(stepConfig.key)}
        </>
      );
    }

    // Photos step (5)
    if (stepConfig.key === 'photos') {
      const photos = formData.photos as string[];
      return (
        <>
          <Text style={styles.sectionTitle}>
            {photos.length > 0 ? t('listing.managePhotos') : t('listing.addPhotos')}
          </Text>

          {photos.length === 0 ? (
            <>
              {/* Upload Area */}
              <TouchableOpacity
                style={styles.photoUploadContainer}
                onPress={handlePickPhotos}
              >
                <ImageUploadIcon size={sp(48)} color="#212121" />
                <Text style={styles.photoUploadText}>
                  {t('listing.uploadPhotos')}
                </Text>
              </TouchableOpacity>

              {/* Requirements */}
              <View style={styles.photoRequirements}>
                <Text style={styles.photoRequirementsTitle}>{t('listing.photoRequirements')}</Text>
                <View style={styles.photoRequirementItem}>
                  <Text style={styles.photoRequirementBullet}>•</Text>
                  <Text style={styles.photoRequirementText}>{t('listing.photoReq1')}</Text>
                </View>
                <View style={styles.photoRequirementItem}>
                  <Text style={styles.photoRequirementBullet}>•</Text>
                  <Text style={styles.photoRequirementText}>{t('listing.photoReq2')}</Text>
                </View>
                <View style={styles.photoRequirementItem}>
                  <Text style={styles.photoRequirementBullet}>•</Text>
                  <Text style={styles.photoRequirementText}>{t('listing.photoReq3')}</Text>
                </View>
              </View>
            </>
          ) : (
            /* Photo Grid */
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoDeleteButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Trash2 size={sp(16)} color="#212121" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 10 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handlePickPhotos}
                >
                  <View style={styles.addPhotoIcon}>
                    <Plus size={sp(24)} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      );
    }

    // Overview step (6)
    if (stepConfig.key === 'overview') {
      return (
        <>
          <Text style={styles.sectionTitle}>{t('listing.listingOverview')}</Text>

          <TouchableOpacity
            style={styles.overviewItem}
            onPress={() => setCurrentStep(1)}
          >
            <Text style={styles.overviewItemText}>{t('listing.basicInformation')}</Text>
            <ChevronRight size={sp(20)} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.overviewItem}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={styles.overviewItemText}>{t('listing.caliberInformation')}</Text>
            <ChevronRight size={sp(20)} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.overviewItem}
            onPress={() => setCurrentStep(3)}
          >
            <Text style={styles.overviewItemText}>{t('listing.caseInformation')}</Text>
            <ChevronRight size={sp(20)} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.overviewItem}
            onPress={() => setCurrentStep(4)}
          >
            <Text style={styles.overviewItemText}>{t('listing.braceletStrapInformation')}</Text>
            <ChevronRight size={sp(20)} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.overviewItem}
            onPress={() => setCurrentStep(5)}
          >
            <Text style={styles.overviewItemText}>{t('listing.photos')}</Text>
            <ChevronRight size={sp(20)} color="#C7C7CC" />
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  // Get button text based on step and mode
  const getButtonText = () => {
    if (currentStep === 6) return isEditMode ? t('common.update') : t('common.save');
    if (currentStep === 5 && formData.photos.length === 0) return t('common.continue');
    if (currentStep === 5) return isEditMode ? t('common.update') : t('listing.createNewListing');
    return t('common.continue');
  };

  // Check if continue button should be disabled
  // For buy orders and edit mode, photos are optional
  const isButtonDisabled = () => {
    if (currentStep === 5 && formData.photos.length === 0 && !isBuyOrder && !isEditMode) return true;
    return false;
  };

  // Show loading state while listing fields are loading or order details are loading
  // This prevents rendering the form before we know which fields are enabled
  const showLoading = !loadingTimedOut && (isLoadingListingFields || isLoadingOrder || (!isConfigReady && !configError));

  if (showLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={sp(24)} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? t('listing.editListing') : t('listing.createNewListing')}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#212121" />
          <Text style={{ marginTop: hp(16), fontFamily: fonts.medium, color: '#212121' }}>
            {t('common.loadingConfiguration')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if config failed to load or loading timed out
  if ((configError || loadingTimedOut) && !isConfigReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={sp(24)} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? t('listing.editListing') : t('listing.createNewListing')}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: wp(24) }}>
          <Text style={{ fontFamily: fonts.medium, color: '#212121', textAlign: 'center' }}>
            {t('listing.failedToLoadConfig')}
          </Text>
          <TouchableOpacity
            onPress={() => { setLoadingTimedOut(false); loadListingFields(); }}
            style={{ marginTop: hp(16), paddingVertical: hp(12), paddingHorizontal: wp(24), backgroundColor: '#212121', borderRadius: sp(8) }}
          >
            <Text style={{ fontFamily: fonts.medium, color: '#FFFFFF' }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <BackArrow size={sp(24)} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentStep === 6 ? t('listing.listingOverview') : (isEditMode ? (isBuyOrder ? t('listing.editBuyOrder') : t('listing.editListing')) : (isNewBuyOrder ? t('listing.createBuyOrder') : t('listing.createNewListing')))}
        </Text>
        {/* Placeholder to balance header when not in edit mode */}
        {!isEditMode && <View style={{ width: sp(44) }} />}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Bottom Section - Progress Indicator and Button */}
      <View style={styles.bottomButtonsContainer} onTouchStart={Keyboard.dismiss}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (isButtonDisabled() || isSaving) && styles.continueButtonDisabled,
          ]}
          onPress={currentStep === 6 ? handleSave : (currentStep === 5 && formData.photos.length > 0 ? () => setCurrentStep(6) : handleNext)}
          disabled={isButtonDisabled() || isSaving}
        >
          <Text style={styles.continueButtonText}>
            {isSaving ? t('common.saving') : getButtonText()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowDropdown(false)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowDropdown(false)}
          />
          <View style={styles.dropdownContent}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{dropdownTitle}</Text>
              <TouchableOpacity
                style={styles.dropdownCloseButton}
                onPress={() => setShowDropdown(false)}
              >
                <X size={sp(18)} color="#212121" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.dropdownScrollContent}>
              {dropdownOptions.map((option) => {
                const isSelected = dropdownField ? getFormValue(dropdownField) === option : false;
                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => selectOption(option)}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isSelected && styles.dropdownOptionSelected,
                      ]}
                    >
                      {option}
                    </Text>
                    {isSelected && (
                      <Check size={sp(20)} color="#212121" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* iOS keyboard toolbar for numeric fields — renders above the keyboard natively */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardToolbar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={Keyboard.dismiss} style={styles.keyboardDoneButton}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </SafeAreaView>
  );
}
