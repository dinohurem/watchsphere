import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { X } from './icons';

interface BrandFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedBrands: string[];
  onApplyBrands: (brands: string[]) => void;
}

const AVAILABLE_BRANDS = [
  'Rolex',
  'Omega',
  'Patek Philippe',
  'Audemars Piguet',
  'Cartier',
  'TAG Heuer',
  'IWC',
  'Breitling',
];

export function BrandFilterModal({ visible, onClose, selectedBrands, onApplyBrands }: BrandFilterModalProps) {
  const { colors, fonts } = useTheme();
  const [tempBrands, setTempBrands] = React.useState<string[]>(selectedBrands);

  React.useEffect(() => {
    setTempBrands(selectedBrands);
  }, [selectedBrands]);

  const handleToggleBrand = (brand: string) => {
    setTempBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const handleApply = () => {
    onApplyBrands(tempBrands);
    onClose();
  };

  const handleReset = () => {
    setTempBrands([]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: 'relative',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: 12,
      padding: 8,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    brandList: {
      gap: 8,
    },
    brandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    brandButtonActive: {
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      borderColor: colors.text,
    },
    brandText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.text,
      letterSpacing: 0.3,
    },
    brandTextActive: {
      color: colors.text,
      fontFamily: fonts.semiBold,
    },
    checkIndicator: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkIndicatorActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    checkMark: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resetButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    applyButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyButtonText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Brands</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Brand Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.brandList}>
              {AVAILABLE_BRANDS.map((brand) => {
                const isSelected = tempBrands.includes(brand);
                return (
                  <TouchableOpacity
                    key={brand}
                    style={[styles.brandButton, isSelected && styles.brandButtonActive]}
                    onPress={() => handleToggleBrand(brand)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkIndicator, isSelected && styles.checkIndicatorActive]}>
                      {isSelected && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={[styles.brandText, isSelected && styles.brandTextActive]}>
                      {brand}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
