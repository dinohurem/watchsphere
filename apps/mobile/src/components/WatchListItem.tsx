import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MiniPriceChart } from './MiniPriceChart';

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
  const { colors } = useTheme();
  const hasPositiveChange = priceChange && priceChange > 0;
  const hasNegativeChange = priceChange && priceChange < 0;

  // Determine chart color based on price trend
  const chartColor = hasPositiveChange ? colors.success : hasNegativeChange ? colors.error : colors.primary;

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    leftSection: {
      flex: 1,
    },
    centerSection: {
      marginHorizontal: 12,
      justifyContent: 'center',
    },
    rightSection: {
      alignItems: 'flex-end',
    },
    title: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textTertiary,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 2,
    },
    fromText: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textTertiary,
    },
    price: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    priceChangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    priceChangeUp: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.success,
    },
    priceChangeDown: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.error,
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
            <Text style={styles.fromText}>from </Text>
            <Text style={styles.price}>€{price.toLocaleString()}</Text>
          </View>
          {priceChange !== undefined && (
            <View style={styles.priceChangeRow}>
              <Text style={hasPositiveChange ? styles.priceChangeUp : styles.priceChangeDown}>
                {hasPositiveChange ? '▲' : '▼'} {Math.abs(priceChange).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
