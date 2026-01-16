import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfig } from '@/contexts/ConfigContext';
import { api } from '@/services/api';
import { BackArrow, ChevronDown, ChevronRight, Plus, X, Trash2, Check } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

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
  gender: string;
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

  // Step 3: Case Information
  caseMaterialDetail: string;
  caseDiameter: string;
  waterResistance: string;
  bezelMaterial: string;
  crystal: string;
  dialColor: string;
  dialNumbers: string;

  // Step 4: Bracelet/Strap Information
  braceletMaterialDetail: string;
  braceletColor: string;
  claspType: string;
  claspMaterial: string;

  // Step 5: Photos
  photos: string[];
}

export default function CreateListingScreen() {
  const { colors, fonts } = useTheme();
  const { getFieldOptions, loadListingFields, isLoadingListingFields, isFieldEnabled, listingFields, error: configError } = useConfig();

  // Load listing fields when component mounts
  useEffect(() => {
    loadListingFields();
  }, [loadListingFields]);
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

  // Check if we're in edit mode
  const isEditMode = params.editMode === 'true';
  const orderId = params.orderId;
  const isBuyOrder = params.orderType === 'buy';
  const [isSaving, setIsSaving] = useState(false);

  // Current step (1-6)
  const [currentStep, setCurrentStep] = useState(1);

  // Helper to get options as string array from config
  const getOptionsForField = useCallback((fieldKey: string, parentValue?: string): string[] => {
    const options = getFieldOptions(fieldKey, parentValue);
    return options.map(opt => opt.label);
  }, [getFieldOptions]);

  // Dropdown modal state
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownField, setDropdownField] = useState<keyof ListingFormData | null>(null);
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [dropdownTitle, setDropdownTitle] = useState('');

  // Derive box and papers value for edit mode
  const getBoxAndPapersValue = () => {
    const hasBox = params.has_box === 'true';
    const hasPapers = params.has_papers === 'true';
    if (hasBox && hasPapers) return 'Box and Papers';
    if (hasBox) return 'Box Only';
    if (hasPapers) return 'Papers Only';
    return '';
  };

  // Derive condition value for edit mode
  const getConditionValue = () => {
    if (params.condition === 'unworn' || params.condition === 'Unworn') return 'Unworn';
    if (params.condition) return 'Used';
    return '';
  };

  // Form data - pre-populated if coming from sell order or edit mode
  const [formData, setFormData] = useState<ListingFormData>({
    // Step 1: Basic Information - pre-populate from params
    brand: params.brand || '',
    model: params.model || '',
    reference: params.reference || '',
    year: '',
    size: '',
    movement: '',
    caseMaterial: '',
    braceletMaterial: '',
    condition: isEditMode ? getConditionValue() : '',
    conditionDescription: '',
    boxAndPapers: isEditMode ? getBoxAndPapersValue() : '',
    gender: '',
    location: isEditMode ? (params.country_name || '') : '',
    price: isEditMode ? (params.price || '') : '',
    currency: 'EUR',
    availability: '',

    // Step 2: Caliber Information
    movementType: '',
    caliberMovement: '',
    baseCaliber: '',
    powerReserve: '',
    numberOfJewels: '',

    // Step 3: Case Information
    caseMaterialDetail: '',
    caseDiameter: '',
    waterResistance: '',
    bezelMaterial: '',
    crystal: '',
    dialColor: '',
    dialNumbers: '',

    // Step 4: Bracelet/Strap Information
    braceletMaterialDetail: '',
    braceletColor: '',
    claspType: '',
    claspMaterial: '',

    // Step 5: Photos
    photos: [],
  });

  // Update form field
  const updateField = useCallback((field: keyof ListingFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Open dropdown
  const openDropdown = useCallback((field: keyof ListingFormData, options: string[], title: string) => {
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

  // Get model options based on selected brand
  const getModelOptions = useCallback(() => {
    return getOptionsForField('model', formData.brand);
  }, [formData.brand, getOptionsForField]);

  // Handle photo pick
  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant access to your photo library');
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

  // Handle save listing (create or update)
  const handleSave = useCallback(async () => {
    if (isSaving) return;
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
      const priceValue = parseInt(formData.price.replace(/[^0-9]/g, ''), 10) || 0;

      if (isEditMode && orderId) {
        // Update existing order - only send fields the backend accepts
        const updateData = {
          price: priceValue,
          condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
          has_box: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Box Only',
          has_papers: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Papers Only',
          notes: formData.conditionDescription || null,
        };

        console.log('Updating order:', orderId, updateData);
        await api.patch(`/orders/${orderId}`, updateData);
        Alert.alert('Success', 'Your order has been updated!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        // Create new order - send all fields
        const orderData = {
          order_type: 'sell',
          brand: formData.brand,
          model: formData.model,
          reference: formData.reference,
          price: priceValue,
          currency: formData.currency,
          condition: formData.condition === 'Unworn' ? 'Unworn' : 'Used',
          country_code: params.country_code || 'US',
          country_name: formData.location,
          has_box: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Box Only',
          has_papers: formData.boxAndPapers === 'Box and Papers' || formData.boxAndPapers === 'Papers Only',
          notes: formData.conditionDescription,
        };

        await api.post('/orders', orderData);
        Alert.alert('Success', 'Your listing has been created!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('Error saving listing:', error?.response?.data || error);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to save listing. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isEditMode, orderId, params.country_code, isBuyOrder, isSaving]);

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

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.sectionTitle}>Basic information</Text>

            {/* Brand */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Brand</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('brand', getOptionsForField('brand'), 'Select Brand')}
              >
                {formData.brand ? (
                  <Text style={styles.fieldValue}>{formData.brand}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>e.g. Rolex</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Model */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Model</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('model', getModelOptions(), 'Select Model')}
              >
                {formData.model ? (
                  <Text style={styles.fieldValue}>{formData.model}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>e.g. Submariner Date</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Reference & Year */}
            <View style={styles.rowFields}>
              {isFieldEnabled('reference') && (
                <View style={[styles.fieldContainer, isFieldEnabled('year') ? styles.halfField : { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Reference</Text>
                  <View style={styles.fieldInputContainer}>
                    <TextInput
                      style={styles.fieldInput}
                      value={formData.reference}
                      onChangeText={(text) => updateField('reference', text)}
                      placeholder="e.g., 126610LN"
                      placeholderTextColor="rgba(29, 29, 31, 0.5)"
                    />
                  </View>
                </View>
              )}
              {isFieldEnabled('year') && (
                <View style={[styles.fieldContainer, isFieldEnabled('reference') ? styles.halfField : { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Year</Text>
                  <View style={styles.fieldInputContainer}>
                    <TextInput
                      style={styles.fieldInput}
                      value={formData.year}
                      onChangeText={(text) => updateField('year', text)}
                      placeholder="e.g.,2024"
                      placeholderTextColor="rgba(29, 29, 31, 0.5)"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Size */}
            {isFieldEnabled('size') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Size</Text>
                <View style={styles.fieldInputContainer}>
                  <TextInput
                    style={styles.fieldInput}
                    value={formData.size}
                    onChangeText={(text) => updateField('size', text)}
                    placeholder="e.g., 41mm"
                    placeholderTextColor="rgba(29, 29, 31, 0.5)"
                  />
                </View>
              </View>
            )}

            {/* Movement */}
            {isFieldEnabled('movement') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Movement</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('movement', getOptionsForField('movement'), 'Select Movement')}
                >
                  {formData.movement ? (
                    <Text style={styles.fieldValue}>{formData.movement}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Select movement type</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Case Material */}
            {isFieldEnabled('case_material') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Case Material</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('caseMaterial', getOptionsForField('case_material'), 'Select Case Material')}
                >
                  {formData.caseMaterial ? (
                    <Text style={styles.fieldValue}>{formData.caseMaterial}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Select case material</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Bracelet Material */}
            {isFieldEnabled('bracelet_material') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Bracelet material</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('braceletMaterial', getOptionsForField('bracelet_material'), 'Select Bracelet Material')}
                >
                  {formData.braceletMaterial ? (
                    <Text style={styles.fieldValue}>{formData.braceletMaterial}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select bracelet material</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Condition */}
            {isFieldEnabled('condition') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Condition</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('condition', getOptionsForField('condition'), 'Select Condition')}
                >
                  {formData.condition ? (
                    <Text style={styles.fieldValue}>{formData.condition}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select condition</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Condition Description */}
            {isFieldEnabled('condition_description') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Condition description</Text>
                <View style={[styles.fieldInputContainer, { alignItems: 'flex-start' }]}>
                  <TextInput
                    style={[styles.fieldInput, styles.textArea]}
                    value={formData.conditionDescription}
                    onChangeText={(text) => updateField('conditionDescription', text)}
                    placeholder="Write a short description..."
                    placeholderTextColor="rgba(29, 29, 31, 0.5)"
                    multiline
                  />
                </View>
              </View>
            )}

            {/* Box and Papers */}
            {isFieldEnabled('box_papers') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Box and papers</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('boxAndPapers', getOptionsForField('box_papers'), 'Select Box and Papers')}
                >
                  {formData.boxAndPapers ? (
                    <Text style={styles.fieldValue}>{formData.boxAndPapers}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select condition</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Gender */}
            {isFieldEnabled('gender') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('gender', getOptionsForField('gender'), 'Select Gender')}
                >
                  {formData.gender ? (
                    <Text style={styles.fieldValue}>{formData.gender}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select condition</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Location */}
            {isFieldEnabled('location') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Location</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('location', getOptionsForField('location'), 'Select Location')}
                >
                  {formData.location ? (
                    <Text style={styles.fieldValue}>{formData.location}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select location</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Price */}
            {isFieldEnabled('price') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Price</Text>
                <View style={styles.fieldInputContainer}>
                  <TextInput
                    style={styles.fieldInput}
                    value={formData.price}
                    onChangeText={(text) => updateField('price', formatPriceInput(text))}
                    placeholder="e.g., 12,450"
                    placeholderTextColor="rgba(29, 29, 31, 0.5)"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            {/* Currency */}
            {isFieldEnabled('currency') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('currency', getOptionsForField('currency'), 'Select Currency')}
                >
                  {formData.currency ? (
                    <Text style={styles.fieldValue}>{formData.currency}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select currency for payments</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}

            {/* Availability */}
            {isFieldEnabled('availability') && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Availability</Text>
                <TouchableOpacity
                  style={styles.fieldInputContainer}
                  onPress={() => openDropdown('availability', getOptionsForField('availability'), 'Select Availability')}
                >
                  {formData.availability ? (
                    <Text style={styles.fieldValue}>{formData.availability}</Text>
                  ) : (
                    <Text style={styles.fieldPlaceholder}>Please select availability</Text>
                  )}
                  <ChevronDown size={sp(18)} color="#1D1D1F" />
                </TouchableOpacity>
              </View>
            )}
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.sectionTitle}>Caliber information</Text>

            {/* Movement Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Movement</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('movementType', getOptionsForField('movement'), 'Select Movement')}
              >
                {formData.movementType ? (
                  <Text style={styles.fieldValue}>{formData.movementType}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select type of movement</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Caliber/Movement */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Caliber/movement</Text>
              <View style={styles.fieldInputContainer}>
                <TextInput
                  style={styles.fieldInput}
                  value={formData.caliberMovement}
                  onChangeText={(text) => updateField('caliberMovement', text)}
                  placeholder="e.g. 3235"
                  placeholderTextColor="rgba(29, 29, 31, 0.5)"
                />
              </View>
            </View>

            {/* Base Caliber */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Base Caliber</Text>
              <View style={styles.fieldInputContainer}>
                <TextInput
                  style={styles.fieldInput}
                  value={formData.baseCaliber}
                  onChangeText={(text) => updateField('baseCaliber', text)}
                  placeholder="e.g., 3235"
                  placeholderTextColor="rgba(29, 29, 31, 0.5)"
                />
              </View>
            </View>

            {/* Power Reserve */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Power reserve</Text>
              <View style={styles.fieldInputContainer}>
                <TextInput
                  style={styles.fieldInput}
                  value={formData.powerReserve}
                  onChangeText={(text) => updateField('powerReserve', text)}
                  placeholder="e.g. 70h"
                  placeholderTextColor="rgba(29, 29, 31, 0.5)"
                />
              </View>
            </View>

            {/* Number of Jewels */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Number of jewels</Text>
              <View style={styles.fieldInputContainer}>
                <TextInput
                  style={styles.fieldInput}
                  value={formData.numberOfJewels}
                  onChangeText={(text) => updateField('numberOfJewels', text)}
                  placeholder="e.g. 20"
                  placeholderTextColor="rgba(29, 29, 31, 0.5)"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.sectionTitle}>Case information</Text>

            {/* Case Material */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Case material</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('caseMaterialDetail', getOptionsForField('case_material'), 'Select Case Material')}
              >
                {formData.caseMaterialDetail ? (
                  <Text style={styles.fieldValue}>{formData.caseMaterialDetail}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select type of movement</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Case Diameter */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Case diameter</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('caseDiameter', getOptionsForField('case_diameter'), 'Select Case Diameter')}
              >
                {formData.caseDiameter ? (
                  <Text style={styles.fieldValue}>{formData.caseDiameter}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select case diameter</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Water Resistance */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Water resistance</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('waterResistance', getOptionsForField('water_resistance'), 'Select Water Resistance')}
              >
                {formData.waterResistance ? (
                  <Text style={styles.fieldValue}>{formData.waterResistance}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select water resistance standard</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Bezel Material */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Bezel material</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('bezelMaterial', getOptionsForField('bezel_material'), 'Select Bezel Material')}
              >
                {formData.bezelMaterial ? (
                  <Text style={styles.fieldValue}>{formData.bezelMaterial}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select bezel material</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Crystal */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Crystal</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('crystal', getOptionsForField('crystal'), 'Select Crystal')}
              >
                {formData.crystal ? (
                  <Text style={styles.fieldValue}>{formData.crystal}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select crystal type</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Dial */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Dial</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('dialColor', getOptionsForField('dial_color'), 'Select Dial Color')}
              >
                {formData.dialColor ? (
                  <Text style={styles.fieldValue}>{formData.dialColor}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select dial color</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Dial Numbers */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Dial Numbers</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('dialNumbers', getOptionsForField('dial_numbers'), 'Select Dial Numbers')}
              >
                {formData.dialNumbers ? (
                  <Text style={styles.fieldValue}>{formData.dialNumbers}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select dial numbers</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>
          </>
        );

      case 4:
        return (
          <>
            <Text style={styles.sectionTitle}>Bracelet / Strap information</Text>

            {/* Bracelet Material */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Case material</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('braceletMaterialDetail', getOptionsForField('bracelet_material'), 'Select Material')}
              >
                {formData.braceletMaterialDetail ? (
                  <Text style={styles.fieldValue}>{formData.braceletMaterialDetail}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Type in case material</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Bracelet Color */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Bracelet color</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('braceletColor', getOptionsForField('bracelet_color'), 'Select Color')}
              >
                {formData.braceletColor ? (
                  <Text style={styles.fieldValue}>{formData.braceletColor}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Type in bracelet color</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Clasp */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Clasp</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('claspType', getOptionsForField('clasp_type'), 'Select Clasp Type')}
              >
                {formData.claspType ? (
                  <Text style={styles.fieldValue}>{formData.claspType}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select clasp type</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>

            {/* Clasp Material */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Clasp material</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('claspMaterial', getOptionsForField('clasp_material'), 'Select Clasp Material')}
              >
                {formData.claspMaterial ? (
                  <Text style={styles.fieldValue}>{formData.claspMaterial}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Select clasp material</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>
          </>
        );

      case 5:
        return (
          <>
            <Text style={styles.sectionTitle}>
              {formData.photos.length > 0 ? 'Manage your photos' : 'Add your photos'}
            </Text>

            {formData.photos.length === 0 ? (
              <>
                {/* Upload Area */}
                <TouchableOpacity
                  style={styles.photoUploadContainer}
                  onPress={handlePickPhotos}
                >
                  <ImageUploadIcon size={sp(48)} color="#212121" />
                  <Text style={styles.photoUploadText}>
                    <Text style={styles.photoUploadTextBold}>Upload</Text> photos of your watch
                  </Text>
                </TouchableOpacity>

                {/* Requirements */}
                <View style={styles.photoRequirements}>
                  <Text style={styles.photoRequirementsTitle}>Your photos must have</Text>
                  <View style={styles.photoRequirementItem}>
                    <Text style={styles.photoRequirementBullet}>•</Text>
                    <Text style={styles.photoRequirementText}>A clear, well-lit view of the watch</Text>
                  </View>
                  <View style={styles.photoRequirementItem}>
                    <Text style={styles.photoRequirementBullet}>•</Text>
                    <Text style={styles.photoRequirementText}>Close-up of the dial, case, and bracelet</Text>
                  </View>
                  <View style={styles.photoRequirementItem}>
                    <Text style={styles.photoRequirementBullet}>•</Text>
                    <Text style={styles.photoRequirementText}>Real condition, filters and editing should be avoided</Text>
                  </View>
                </View>
              </>
            ) : (
              /* Photo Grid */
              <View style={styles.photoGrid}>
                {formData.photos.map((photo, index) => (
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
                {formData.photos.length < 10 && (
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

      case 6:
        return (
          <>
            <Text style={styles.sectionTitle}>Listing overview</Text>

            <TouchableOpacity
              style={styles.overviewItem}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={styles.overviewItemText}>Basics</Text>
              <ChevronRight size={sp(20)} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overviewItem}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.overviewItemText}>Caliber Information</Text>
              <ChevronRight size={sp(20)} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overviewItem}
              onPress={() => setCurrentStep(3)}
            >
              <Text style={styles.overviewItemText}>Bracelet / Strap information</Text>
              <ChevronRight size={sp(20)} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.overviewItem}
              onPress={() => setCurrentStep(5)}
            >
              <Text style={styles.overviewItemText}>Photos</Text>
              <ChevronRight size={sp(20)} color="#C7C7CC" />
            </TouchableOpacity>
          </>
        );

      default:
        return null;
    }
  };

  // Get button text based on step
  const getButtonText = () => {
    if (currentStep === 6) return 'Save';
    if (currentStep === 5 && formData.photos.length === 0) return 'Continue';
    if (currentStep === 5) return isEditMode ? 'Update Listing' : 'Create Listing';
    return 'Continue';
  };

  // Check if continue button should be disabled
  const isButtonDisabled = () => {
    if (currentStep === 5 && formData.photos.length === 0) return true;
    return false;
  };

  // Show loading state while listing fields are loading or not yet loaded
  // This prevents rendering the form before we know which fields are enabled
  const isConfigReady = listingFields.length > 0;
  const showLoading = isLoadingListingFields || (!isConfigReady && !configError);

  if (showLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={sp(24)} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Listing' : 'Create new listing'}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#212121" />
          <Text style={{ marginTop: hp(16), fontFamily: fonts.medium, color: '#212121' }}>
            Loading configuration...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if config failed to load
  if (configError && !isConfigReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={sp(24)} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Listing' : 'Create new listing'}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: wp(24) }}>
          <Text style={{ fontFamily: fonts.medium, color: '#212121', textAlign: 'center' }}>
            Failed to load configuration. Please try again.
          </Text>
          <TouchableOpacity
            onPress={() => loadListingFields()}
            style={{ marginTop: hp(16), paddingVertical: hp(12), paddingHorizontal: wp(24), backgroundColor: '#212121', borderRadius: sp(8) }}
          >
            <Text style={{ fontFamily: fonts.medium, color: '#FFFFFF' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Simplified edit view for buy orders
  if (isEditMode && isBuyOrder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header with Update button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={sp(24)} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Buy Order</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{ paddingHorizontal: wp(8) }}
          >
            <Text style={{
              fontSize: fp(16),
              fontFamily: fonts.semiBold,
              color: isSaving ? 'rgba(33, 33, 33, 0.4)' : '#212121',
            }}>
              {isSaving ? 'Saving...' : 'Update'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Buy Order Edit Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Edit your buy order</Text>

          {/* Watch Info (read-only) */}
          <View style={[styles.fieldContainer, { backgroundColor: '#F8F8F8', borderRadius: sp(12), padding: wp(16), marginBottom: hp(24) }]}>
            <Text style={{ fontFamily: fonts.semiBold, fontSize: fp(16), color: '#212121' }}>
              {formData.brand} {formData.model}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: fp(14), color: '#666666', marginTop: hp(4) }}>
              {formData.reference}
            </Text>
          </View>

          {/* Price */}
          {isFieldEnabled('price') && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Price</Text>
              <View style={styles.fieldInputContainer}>
                <TextInput
                  style={styles.fieldInput}
                  value={formData.price}
                  onChangeText={(text) => updateField('price', formatPriceInput(text))}
                  placeholder="e.g., 12,450"
                  placeholderTextColor="rgba(29, 29, 31, 0.5)"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* Condition */}
          {isFieldEnabled('condition') && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Condition</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('condition', getOptionsForField('condition'), 'Select Condition')}
              >
                {formData.condition ? (
                  <Text style={styles.fieldValue}>{formData.condition}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Please select condition</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>
          )}

          {/* Box and Papers */}
          {isFieldEnabled('box_papers') && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Box and papers</Text>
              <TouchableOpacity
                style={styles.fieldInputContainer}
                onPress={() => openDropdown('boxAndPapers', getOptionsForField('box_papers'), 'Select Box and Papers')}
              >
                {formData.boxAndPapers ? (
                  <Text style={styles.fieldValue}>{formData.boxAndPapers}</Text>
                ) : (
                  <Text style={styles.fieldPlaceholder}>Please select</Text>
                )}
                <ChevronDown size={sp(18)} color="#1D1D1F" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

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
                {dropdownOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => selectOption(option)}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        dropdownField && formData[dropdownField] === option && styles.dropdownOptionSelected,
                      ]}
                    >
                      {option}
                    </Text>
                    {dropdownField && formData[dropdownField] === option && (
                      <Check size={sp(20)} color="#212121" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
          {currentStep === 6 ? 'Listing overview' : (isEditMode ? 'Edit Listing' : 'Create new listing')}
        </Text>
        {/* Update button for sell order edit mode */}
        {isEditMode && !isBuyOrder && (
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{ paddingHorizontal: wp(8) }}
          >
            <Text style={{
              fontSize: fp(16),
              fontFamily: fonts.semiBold,
              color: isSaving ? 'rgba(33, 33, 33, 0.4)' : '#212121',
            }}>
              {isSaving ? 'Saving...' : 'Update'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}
      </ScrollView>

      {/* Bottom Section - Progress Indicator and Button (hide for edit mode) */}
      {!isEditMode && (
        <View style={styles.bottomButtonsContainer}>
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
              isButtonDisabled() && styles.continueButtonDisabled,
            ]}
            onPress={currentStep === 6 ? handleSave : (currentStep === 5 && formData.photos.length > 0 ? () => setCurrentStep(6) : handleNext)}
            disabled={isButtonDisabled()}
          >
            <Text style={styles.continueButtonText}>{getButtonText()}</Text>
          </TouchableOpacity>
        </View>
      )}

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
              {dropdownOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownOption}
                  onPress={() => selectOption(option)}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      dropdownField && formData[dropdownField] === option && styles.dropdownOptionSelected,
                    ]}
                  >
                    {option}
                  </Text>
                  {dropdownField && formData[dropdownField] === option && (
                    <Check size={sp(20)} color="#212121" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
