import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MiniPriceChart } from './MiniPriceChart';
import { TriangleUp, TriangleDown } from './icons';

interface WatchListItemProps {
  brand: string;
  model: string;
  referenceNumber: string;
  price: number;
  priceChange?: number;
  priceHistory?: number[]; // Array of historical prices for the mini chart
  onPress: () => void;
}

export function WatchListItem({
  brand,
  model,
  referenceNumber,
  price,
  priceChange,
  priceHistory,
  onPress
}: WatchListItemProps) {
  const { colors, fonts } = useTheme();
  const hasPositiveChange = priceChange && priceChange > 0;
  const hasNegativeChange = priceChange && priceChange < 0;

  // Determine chart color based on price trend
  const chartColor = hasPositiveChange ? colors.success : hasNegativeChange ? colors.error : colors.primary;

  const styles = StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingVertical: 12,
      paddingHorizontal: 0,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    leftSection: {
      flex: 1,
      marginRight: 8,
    },
    centerSection: {
      marginLeft: 16,
      marginRight: 12,
      justifyContent: 'center',
    },
    rightSection: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    title: {
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.065,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.065,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    fromLabel: {
      fontSize: 11,
      fontFamily: fonts.regular,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.055,
    },
    price: {
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.065,
    },
    priceChangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    priceChangeIcon: {
      width: 12,
      height: 12,
    },
    priceChangeUp: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: '#4AA078',
    },
    priceChangeDown: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: '#CC6045',
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={styles.title}>{brand} {model}</Text>
          <Text style={styles.subtitle}>{referenceNumber}</Text>
        </View>

        {/* Center section with mini chart */}
        <View style={styles.centerSection}>
          {priceHistory && priceHistory.length > 0 && (
            <MiniPriceChart data={priceHistory} width={80} height={30} color={chartColor} />
          )}
        </View>

        <View style={styles.rightSection}>
          <View style={styles.priceRow}>
            <Text style={styles.fromLabel}>from</Text>
            <Text style={styles.price}>€{price.toLocaleString()}</Text>
          </View>
          {priceChange !== undefined && (
            <View style={styles.priceChangeRow}>
              {hasPositiveChange ? (
                <TriangleUp size={8} color="#4AA078" />
              ) : (
                <TriangleDown size={8} color="#CC6045" />
              )}
              <Text style={hasPositiveChange ? styles.priceChangeUp : styles.priceChangeDown}>
                {Math.abs(priceChange).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
