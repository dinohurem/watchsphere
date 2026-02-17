import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { X } from './icons';
import Svg, { Path } from 'react-native-svg';

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="#1D1D1F"
      />
      <Path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.963 7.963 0 01-4.113-1.14l-.287-.172-2.978.78.795-2.898-.188-.299A7.963 7.963 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
        fill="#1D1D1F"
      />
    </Svg>
  );
}

interface OrderBookEntry {
  country: 'US' | 'EU' | 'UAE' | 'HK';
  date: string;
  condition: string;
  price: string;
  whatsapp_phone?: string;
  currency?: string;
  numericPrice?: number;
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
  watchName?: string;
  reference?: string;
}

export function OrderBookModal({ visible, onClose, buyOrders = [], sellOrders = [], watchName = '', reference = '' }: OrderBookModalProps) {
  const { colors, fonts } = useTheme();
  const [activeTab, setActiveTab] = React.useState<'buy' | 'sell'>('buy');
  const orders = activeTab === 'buy' ? buyOrders : sellOrders;

  const handleWhatsAppChat = (order: OrderBookEntry) => {
    if (!order.whatsapp_phone) return;
    const currency = order.currency || 'EUR';
    const price = order.numericPrice ? order.numericPrice.toLocaleString('de-DE') : order.price;
    const message = `Hi, is ${watchName} ${reference} available?\n${currency} ${price} - thank you very much!`;
    const url = `https://wa.me/${order.whatsapp_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp. Make sure it is installed.');
    });
  };

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
      fontSize: 15,
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
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Market</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Date</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Condition</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Price</Text>
          <Text style={[styles.headerCell, { flex: 0.7, textAlign: 'center' }]}>Chat</Text>
        </View>

        {/* Table Content */}
        <ScrollView style={styles.tableContent}>
          {orders.map((order, index) => {
            const { emoji, abbr } = countryData[order.country] || { emoji: '🏳️', abbr: order.country?.toUpperCase() || '??' };
            return (
              <TouchableOpacity
                key={index}
                style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}
                onPress={() => handleOrderPress(index)}
              >
                <View style={[styles.marketCell, { flex: 1, justifyContent: 'center' }]}>
                  <Text style={styles.flagEmoji}>{emoji}</Text>
                  <Text style={styles.marketName}>{abbr}</Text>
                </View>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{order.date}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{order.condition}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>
                  {order.currency && order.currency !== 'EUR' ? `${order.currency} ` : '€'}{order.price}
                </Text>
                <TouchableOpacity
                    style={{ flex: 0.7, alignItems: 'center', justifyContent: 'center' }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleWhatsAppChat(order);
                    }}
                    disabled={!order.whatsapp_phone}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <WhatsAppIcon size={20} />
                  </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
