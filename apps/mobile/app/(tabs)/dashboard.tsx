import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, X } from '@/components/icons';
import { WatchlistCard } from '@/components/WatchlistCard';
import { LogoIcon } from '@/components/LogoIcon';
import { wp, hp, sp, fp } from '@/utils/responsive';

interface ListingStep {
  id: number;
  title: string;
  completed: boolean;
}

export default function DashboardScreen() {
  const { colors, fonts } = useTheme();
  const [inventory] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Mock watchlist data
  const watchlist = [
    {
      id: '1',
      name: 'Rolex Submariner',
      code: '126610LN',
      price: 12352,
      priceChange: -0.7,
      priceHistory: [12500, 12450, 12400, 12380, 12370, 12352],
    },
    {
      id: '2',
      name: 'Patek Philippe Nautilus',
      code: '5712/1A',
      price: 97467,
      priceChange: 1.2,
      priceHistory: [95000, 95500, 96000, 96500, 97000, 97467],
    },
    {
      id: '3',
      name: 'Audemars Piguet Royal Oak',
      code: '15500ST',
      price: 65000,
      priceChange: 0.5,
      priceHistory: [64000, 64200, 64500, 64700, 64900, 65000],
    },
  ];

  const steps: ListingStep[] = [
    { id: 1, title: 'Basic information', completed: currentStep > 1 },
    { id: 2, title: 'Caliber information', completed: currentStep > 2 },
    { id: 3, title: 'Case information', completed: currentStep > 3 },
    { id: 4, title: 'Bracelet/Strap information', completed: currentStep > 4 },
    { id: 5, title: 'Photos', completed: currentStep > 5 },
    { id: 6, title: 'Listing overview', completed: false },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    headerTitle: {
      fontSize: fp(19),
      fontFamily: fonts.semiBold,
      color: colors.text,
      letterSpacing: 0.5,
    },
    addButton: {
      padding: sp(4),
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: hp(16),
    },
    section: {
      marginBottom: 0,
    },
    sectionHeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
    },
    sectionTitleText: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(21),
      letterSpacing: 0.085,
    },
    sectionContent: {
      paddingHorizontal: wp(16),
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      marginVertical: hp(16),
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp(32),
      paddingTop: hp(100),
    },
    emptyIconContainer: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(80),
      backgroundColor: '#F7F7F7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(24),
    },
    emptyTitle: {
      fontSize: fp(21),
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      marginBottom: hp(12),
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fp(16),
      fontFamily: fonts.regular,
      color: '#1D1D1F',
      textAlign: 'center',
      marginBottom: hp(24),
      opacity: 0.6,
      lineHeight: fp(21),
    },
    createButton: {
      backgroundColor: '#212121',
      paddingHorizontal: wp(20),
      paddingVertical: hp(14),
      borderRadius: sp(12),
    },
    createButtonText: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: wp(12),
    },
    inventoryCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: sp(12),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    inventoryImage: {
      width: '100%',
      height: hp(120),
      backgroundColor: colors.backgroundSecondary,
    },
    inventoryInfo: {
      padding: wp(12),
    },
    inventoryBrand: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: hp(2),
    },
    inventoryReference: {
      fontSize: fp(13),
      color: colors.textSecondary,
      marginBottom: hp(8),
    },
    inventoryPrice: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp(16),
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: fp(19),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    closeButton: {
      padding: sp(8),
    },
    modalContent: {
      flex: 1,
    },
    stepperContainer: {
      paddingVertical: hp(24),
      paddingHorizontal: wp(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: hp(24),
    },
    stepIndicator: {
      width: sp(32),
      height: sp(32),
      borderRadius: sp(16),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: wp(12),
    },
    stepIndicatorActive: {
      backgroundColor: colors.primary,
    },
    stepIndicatorCompleted: {
      backgroundColor: colors.primary,
    },
    stepIndicatorInactive: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 2,
      borderColor: colors.border,
    },
    stepNumber: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
    },
    stepNumberActive: {
      color: '#FFFFFF',
    },
    stepNumberInactive: {
      color: colors.textSecondary,
    },
    stepLine: {
      position: 'absolute',
      left: sp(15),
      top: sp(32),
      width: 2,
      height: hp(24),
    },
    stepLineActive: {
      backgroundColor: colors.primary,
    },
    stepLineInactive: {
      backgroundColor: colors.border,
    },
    stepContent: {
      flex: 1,
      paddingTop: hp(4),
    },
    stepTitle: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    stepTitleActive: {
      color: colors.primary,
    },
    formContainer: {
      padding: wp(16),
    },
    formSection: {
      marginBottom: hp(24),
    },
    sectionTitle: {
      fontSize: fp(19),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: hp(16),
    },
    input: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: sp(12),
      paddingHorizontal: wp(16),
      paddingVertical: hp(14),
      fontSize: fp(16),
      color: colors.text,
      marginBottom: hp(12),
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: wp(12),
      padding: wp(16),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      flex: 1,
      paddingVertical: hp(14),
      borderRadius: sp(12),
      alignItems: 'center',
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonTextPrimary: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
  });

  const renderStepForm = () => {
    if (currentStep === 1) {
      return (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <TextInput style={styles.input} placeholder="Brand" placeholderTextColor={colors.textTertiary} />
          <TextInput style={styles.input} placeholder="Model" placeholderTextColor={colors.textTertiary} />
          <TextInput style={styles.input} placeholder="Reference Number" placeholderTextColor={colors.textTertiary} />
          <TextInput style={styles.input} placeholder="Year" placeholderTextColor={colors.textTertiary} />
          <TextInput style={styles.input} placeholder="Size" placeholderTextColor={colors.textTertiary} />
        </View>
      );
    }
    // Add more step forms as needed
    return null;
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Plus size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Listings Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitleText}>My Listings</Text>
            </View>
            {inventory.length === 0 ? (
              <View style={[styles.emptyState, { paddingTop: 40 }]}>
                <View style={styles.emptyIconContainer}>
                  <LogoIcon size={36} color="#212121" />
                </View>
                <Text style={styles.emptyTitle}>Create new listings here</Text>
                <Text style={styles.emptySubtitle}>Listing currently empty, list your watches and manage them all in one place.</Text>
                <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
                  <Text style={styles.createButtonText}>Create new listing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.grid, styles.sectionContent]}>
                {inventory.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.inventoryCard}>
                    <Image source={{ uri: item.image }} style={styles.inventoryImage} resizeMode="cover" />
                    <View style={styles.inventoryInfo}>
                      <Text style={styles.inventoryBrand}>{item.brand} {item.model}</Text>
                      <Text style={styles.inventoryReference}>{item.reference}</Text>
                      <Text style={styles.inventoryPrice}>€{item.price.toLocaleString()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Watchlist Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitleText}>Watchlist</Text>
            </View>
            <View style={styles.sectionContent}>
              {watchlist.map((watch) => (
                <WatchlistCard
                  key={watch.id}
                  watch={watch}
                  onPress={() => console.log('Watch pressed:', watch.id)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Create Listing Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Listing</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowCreateModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Stepper */}
          <View style={styles.stepperContainer}>
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.completed;
              const isLast = index === steps.length - 1;

              return (
                <View key={step.id}>
                  <View style={styles.stepItem}>
                    <View>
                      <View
                        style={[
                          styles.stepIndicator,
                          isActive && styles.stepIndicatorActive,
                          isCompleted && styles.stepIndicatorCompleted,
                          !isActive && !isCompleted && styles.stepIndicatorInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumber,
                            (isActive || isCompleted) && styles.stepNumberActive,
                            !isActive && !isCompleted && styles.stepNumberInactive,
                          ]}
                        >
                          {step.id}
                        </Text>
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.stepLine,
                            isCompleted ? styles.stepLineActive : styles.stepLineInactive,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                        {step.title}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Form Content */}
          <ScrollView style={styles.modalContent}>
            <View style={styles.formContainer}>{renderStepForm()}</View>
          </ScrollView>

          {/* Bottom Buttons */}
          <View style={styles.buttonContainer}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Text style={styles.buttonTextSecondary}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => {
                if (currentStep < steps.length) {
                  setCurrentStep(currentStep + 1);
                } else {
                  setShowCreateModal(false);
                  setCurrentStep(1);
                }
              }}
            >
              <Text style={styles.buttonTextPrimary}>
                {currentStep === steps.length ? 'Finish' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
