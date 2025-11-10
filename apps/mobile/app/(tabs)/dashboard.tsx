import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, X, Package, ChevronRight } from '@/components/icons';

// Mock data for now until backend is ready
const mockInventory = [
  {
    id: '1',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN, New Unworn 41mm',
    price: 12352,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN, New Unworn 41mm',
    price: 12352,
    condition: 'New',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN, New Unworn 41mm',
    price: 12352,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop'
  },
  {
    id: '4',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN, New Unworn 41mm',
    price: 12352,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop'
  },
];

interface ListingStep {
  id: number;
  title: string;
  completed: boolean;
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const [inventory, setInventory] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const loading = false;

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
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    addButton: {
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingTop: 100,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    createButton: {
      backgroundColor: colors.text,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    inventoryCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    inventoryImage: {
      width: '100%',
      height: 120,
      backgroundColor: colors.backgroundSecondary,
    },
    inventoryInfo: {
      padding: 12,
    },
    inventoryBrand: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    inventoryReference: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    inventoryPrice: {
      fontSize: 16,
      fontWeight: '600',
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    modalContent: {
      flex: 1,
    },
    stepperContainer: {
      paddingVertical: 24,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
    },
    stepIndicator: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
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
      fontSize: 14,
      fontWeight: '600',
    },
    stepNumberActive: {
      color: '#FFFFFF',
    },
    stepNumberInactive: {
      color: colors.textSecondary,
    },
    stepLine: {
      position: 'absolute',
      left: 15,
      top: 32,
      width: 2,
      height: 24,
    },
    stepLineActive: {
      backgroundColor: colors.primary,
    },
    stepLineInactive: {
      backgroundColor: colors.border,
    },
    stepContent: {
      flex: 1,
      paddingTop: 4,
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    stepTitleActive: {
      color: colors.primary,
    },
    formContainer: {
      padding: 16,
    },
    formSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
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
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      fontSize: 16,
      fontWeight: '600',
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
          {inventory.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Package size={40} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>Create new listings here</Text>
              <Text style={styles.emptySubtitle}>Listing currently empty, list your watches and manage them all in one place.</Text>
              <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.createButtonText}>Create Listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
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
