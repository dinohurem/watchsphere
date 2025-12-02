import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

interface MiniPriceChartProps {
  data: number[]; // Array of price points
  width?: number;
  height?: number;
  color?: string;
}

export function MiniPriceChart({
  data,
  width = 80,
  height = 30,
  color = '#007AFF',
}: MiniPriceChartProps) {
  if (!data || data.length < 2) {
    return <View style={[styles.container, { width, height }]} />;
  }

  // Calculate min and max for normalization
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Create points for the polyline
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
