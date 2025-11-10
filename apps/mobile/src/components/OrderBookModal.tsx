import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { X } from './icons';

interface OrderBookEntry {
  country: 'US' | 'EU' | 'UAE' | 'HK';
  date: string;
  condition: string;
  price: string;
}

const countryData: Record<string, { emoji: string; initials: string }> = {
  US: { emoji: '🇺🇸', initials: 'US' },
  EU: { emoji: '🇪🇺', initials: 'EU' },
  UAE: { emoji: '🇦🇪', initials: 'UAE' },
  HK: { emoji: '🇭🇰', initials: 'HK' },
};

interface OrderBookModalProps {
  visible: boolean;
  onClose: () => void;
  buyOrders?: OrderBookEntry[];
  sellOrders?: OrderBookEntry[];
}

export function OrderBookModal({ visible, onClose, buyOrders = [], sellOrders = [] }: OrderBookModalProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = React.useState<'buy' | 'sell'>('buy');
  const orders = activeTab === 'buy' ? buyOrders : sellOrders;

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
            <X size={20} color="#000000" />
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
          <Text style={[styles.headerCell, { flex: 0.6 }]}>Flag</Text>
          <Text style={[styles.headerCell, { flex: 0.8 }]}>Loc</Text>
          <Text style={[styles.headerCell, { flex: 1 }]}>Date</Text>
          <Text style={[styles.headerCell, { flex: 1.5 }]}>Condition</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
        </View>

        {/* Table Content */}
        <ScrollView style={styles.tableContent}>
          {orders.map((order, index) => {
            const { emoji, initials } = countryData[order.country];
            return (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}
              >
                <View style={[styles.cell, { flex: 0.6 }]}>
                  <View style={styles.flagContainer}>
                    <Text style={styles.flagEmoji}>{emoji}</Text>
                  </View>
                </View>
                <Text style={[styles.cell, { flex: 0.8 }]}>{initials}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{order.date}</Text>
                <Text style={[styles.cell, { flex: 1.5 }]}>{order.condition}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'right' }]}>{order.price}</Text>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#E5E5EA',
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
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 32,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#000000',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  tableContent: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  tableRowEven: {
    backgroundColor: '#F9F9F9',
  },
  cell: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
  },
  flagContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 18,
  },
});
