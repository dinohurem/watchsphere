import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

interface PriceHistoryChartProps {
  data?: number[];
}

const TIME_PERIODS = ['All', '1M', '3M', '6M', '1YR', 'YTD'];

// Sample price history data
const SAMPLE_DATA = [11500, 12200, 11800, 13500, 12800, 14200, 13900, 14800, 14200, 15100, 14600, 15300];

export function PriceHistoryChart({ data = SAMPLE_DATA }: PriceHistoryChartProps) {
  const { colors, fonts } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState('All');

  const chartWidth = 340;
  const chartHeight = 160;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 10;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate min and max for normalization
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate Y-axis labels
  const yLabels = ['15k', '14k', '13k', '12k', '11k'];
  const yLabelValues = [15000, 14000, 13000, 12000, 11000];

  // Create smooth bezier curve path
  const getPointCoords = (index: number) => {
    const x = paddingLeft + (index / (data.length - 1)) * graphWidth;
    const y = paddingTop + graphHeight - ((data[index] - 11000) / 4000) * graphHeight;
    return { x, y };
  };

  const createSmoothPath = () => {
    if (data.length < 2) return '';

    const firstPoint = getPointCoords(0);
    let path = `M ${firstPoint.x} ${firstPoint.y}`;

    for (let i = 0; i < data.length - 1; i++) {
      const current = getPointCoords(i);
      const next = getPointCoords(i + 1);

      // Calculate control points for smooth curve
      const tension = 0.3;
      const prev = i > 0 ? getPointCoords(i - 1) : current;
      const nextNext = i < data.length - 2 ? getPointCoords(i + 2) : next;

      const cp1x = current.x + (next.x - prev.x) * tension;
      const cp1y = current.y + (next.y - prev.y) * tension;
      const cp2x = next.x - (nextNext.x - current.x) * tension;
      const cp2y = next.y - (nextNext.y - current.y) * tension;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }

    return path;
  };

  const smoothPath = createSmoothPath();

  // Get last point for indicator dot
  const lastX = paddingLeft + graphWidth;
  const lastY = paddingTop + graphHeight - ((data[data.length - 1] - 11000) / 4000) * graphHeight;

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    chartContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      overflow: 'hidden',
    },
    chartArea: {
      position: 'relative',
    },
    yAxisLabels: {
      position: 'absolute',
      left: 8,
      top: paddingTop,
      height: graphHeight,
      justifyContent: 'space-between',
    },
    yLabel: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      opacity: 0.5,
    },
    periodTabs: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
    },
    periodTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
    },
    periodTabActive: {
      backgroundColor: '#212121',
    },
    periodTabText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
    },
    periodTabTextActive: {
      color: '#FFFFFF',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Price History</Text>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.chartArea}>
          {/* Y-axis labels */}
          <View style={styles.yAxisLabels}>
            {yLabels.map((label) => (
              <Text key={label} style={styles.yLabel}>{label}</Text>
            ))}
          </View>

          {/* Chart SVG */}
          <Svg width={chartWidth} height={chartHeight}>
            {/* Grid lines */}
            {yLabelValues.map((value, index) => {
              const y = paddingTop + (index / (yLabelValues.length - 1)) * graphHeight;
              return (
                <Line
                  key={value}
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  opacity={0.15}
                />
              );
            })}

            {/* Smooth price line */}
            <Path
              d={smoothPath}
              fill="none"
              stroke="#212121"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* End point indicator */}
            <Circle
              cx={lastX}
              cy={lastY}
              r={5}
              fill="#212121"
            />
            <Circle
              cx={lastX}
              cy={lastY}
              r={8}
              fill="#212121"
              opacity={0.3}
            />
          </Svg>
        </View>

        {/* Time period tabs */}
        <View style={styles.periodTabs}>
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodTab,
                selectedPeriod === period && styles.periodTabActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === period && styles.periodTabTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
