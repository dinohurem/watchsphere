import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface WatchListItemProps {
  brand: string;
  model: string;
  referenceNumber: string;
  price: number;
  priceChange?: number;
  onPress: () => void;
}

export function WatchListItem({
  brand,
  model,
  referenceNumber,
  price,
  priceChange,
  onPress
}: WatchListItemProps) {
  const formattedPrice = `€${price.toLocaleString()}`;
  const hasPositiveChange = priceChange && priceChange > 0;
  const hasNegativeChange = priceChange && priceChange < 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={styles.title}>{brand} {model}</Text>
          <Text style={styles.subtitle}>{referenceNumber}</Text>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.price}>{formattedPrice}</Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  priceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceChangeUp: {
    fontSize: 13,
    fontWeight: '400',
    color: '#34C759',
  },
  priceChangeDown: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FF3B30',
  },
});
