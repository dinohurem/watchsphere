import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { X } from './icons';

interface OrderBookEntry {
  country: 'US' | 'EU' | 'UAE' | 'HK';
  date: string;
  condition: string;
  price: string;
}

const countryData: Record<string, { emoji: string; abbr: string }> = {
  US: { emoji: '🇺🇸', abbr: 'US' },
  EU: { emoji: '🇪🇺', abbr: 'EU' },
  UAE: { emoji: '🇦🇪', abbr: 'UAE' },
  HK: { emoji: '🇭🇰', abbr: 'HK' },
  UK: { emoji: '🇬🇧', abbr: 'UK' },
  CH: { emoji: '🇨🇭', abbr: 'CH' },
};

interface OrderBookModalProps {
  visible: boolean;
  onClose: () => void;
  buyOrders?: OrderBookEntry[];
  sellOrders?: OrderBookEntry[];
}

export function OrderBookModal({ visible, onClose, buyOrders = [], sellOrders = [] }: OrderBookModalProps) {
  const { colors, fonts } = useTheme();
  const [activeTab, setActiveTab] = React.useState<'buy' | 'sell'>('buy');
  const orders = activeTab === 'buy' ? buyOrders : sellOrders;

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.card,
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    handle: {
      width: 36,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 2.5,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    headerRight: {
      width: 32,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      padding: 2,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentText: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.text,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCell: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    tableContent: {
      flex: 1,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    tableRowEven: {
      backgroundColor: colors.backgroundSecondary,
    },
    cell: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.text,
    },
    marketCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    flagEmoji: {
      fontSize: 18,
    },
    marketName: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.text,
    },
  }), [fonts, colors]);

  const handleOrderPress = (index: number) => {
    onClose();
    // Navigate to watch details page with the order index as ID
    router.push(`/watch-details/${index}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Book</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'buy' && styles.segmentActive]}
            onPress={() => setActiveTab('buy')}
          >
            <Text style={[styles.segmentText, activeTab === 'buy' && styles.segmentTextActive]}>
              Buy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'sell' && styles.segmentActive]}
            onPress={() => setActiveTab('sell')}
          >
            <Text style={[styles.segmentText, activeTab === 'sell' && styles.segmentTextActive]}>
              Sell
            </Text>
          </TouchableOpacity>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 1.5 }]}>Market</Text>
          <Text style={[styles.headerCell, { flex: 0.8 }]}>Date</Text>
          <Text style={[styles.headerCell, { flex: 1.5 }]}>Condition</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
        </View>

        {/* Table Content */}
        <ScrollView style={styles.tableContent}>
          {orders.map((order, index) => {
            const { emoji, abbr } = countryData[order.country];
            return (
              <TouchableOpacity
                key={index}
                style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}
                onPress={() => handleOrderPress(index)}
              >
                <View style={[styles.marketCell, { flex: 1.5 }]}>
                  <Text style={styles.flagEmoji}>{emoji}</Text>
                  <Text style={styles.marketName}>{abbr}</Text>
                </View>
                <Text style={[styles.cell, { flex: 0.8 }]}>{order.date}</Text>
                <Text style={[styles.cell, { flex: 1.5 }]}>{order.condition}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'right' }]}>{order.price}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
