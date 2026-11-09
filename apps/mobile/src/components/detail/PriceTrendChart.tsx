/**
 * Line chart for the price trend sheet (spec v3, B / B1): Fresh in blue #3478F6, Used in grey
 * #AEAEB2. Green / red are never used for the lines. M2: the lines draw from left to right
 * (≈1 s) and the area under the Fresh line fades in afterwards – only when `animate` is true.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/contexts/ThemeContext';
import { formatPrice } from '@/utils/marketFormat';
import { fp, hp, wp } from '@/utils/responsive';

import { DETAIL_COLORS as C, TrendPoint } from './detailTypes';
import { useReduceMotion } from './motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  if (!y || !m) return iso;
  return d ? `${d} ${MONTHS[m - 1]}` : `${MONTHS[m - 1]} ${y}`;
}

function polylineLength(points: { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return Math.max(1, total);
}

export function PriceTrendChart({
  fresh,
  used,
  currency,
  width,
  height = hp(170),
  animate,
}: {
  fresh: TrendPoint[];
  used: TrendPoint[];
  currency: string;
  width: number;
  height?: number;
  animate: boolean;
}) {
  const { fonts } = useTheme();
  const reduce = useReduceMotion();
  const draw = useRef(new Animated.Value(animate && !reduce ? 0 : 1)).current;
  const area = useRef(new Animated.Value(animate && !reduce ? 0 : 1)).current;

  const labelWidth = wp(62);
  const top = 8;
  const bottom = 22;
  const plotW = Math.max(10, width - labelWidth - 6);
  const plotH = Math.max(10, height - top - bottom);

  const geometry = useMemo(() => {
    const dates = Array.from(new Set([...fresh, ...used].map((p) => p.date))).sort();
    const values = [...fresh, ...used].map((p) => p.median).filter((v) => Number.isFinite(v));
    if (dates.length === 0 || values.length === 0) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    const padding = (max - min || max * 0.05 || 1) * 0.15;
    min -= padding;
    max += padding;
    const xFor = (date: string) => {
      const idx = dates.indexOf(date);
      return labelWidth + (dates.length === 1 ? plotW / 2 : (idx / (dates.length - 1)) * plotW);
    };
    const yFor = (value: number) => top + (1 - (value - min) / (max - min)) * plotH;
    const toPoints = (series: TrendPoint[]) =>
      series
        .filter((p) => Number.isFinite(p.median))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((p) => ({ x: xFor(p.date), y: yFor(p.median) }));
    const freshPts = toPoints(fresh);
    const usedPts = toPoints(used);
    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const ticks = [0, 1, 2, 3].map((i) => {
      const value = max - ((max - min) * i) / 3;
      return { y: yFor(value), value };
    });
    const labelCount = Math.min(5, dates.length);
    const xLabels =
      labelCount <= 1
        ? dates.map((d) => ({ x: xFor(d), text: shortDate(d) }))
        : Array.from({ length: labelCount }, (_, i) => {
            const d = dates[Math.round((i / (labelCount - 1)) * (dates.length - 1))];
            return { x: xFor(d), text: shortDate(d) };
          });
    const freshArea =
      freshPts.length > 1
        ? `${toPath(freshPts)} L${freshPts[freshPts.length - 1].x.toFixed(1)} ${top + plotH} L${freshPts[0].x.toFixed(1)} ${top + plotH} Z`
        : null;
    return {
      freshPath: toPath(freshPts),
      usedPath: toPath(usedPts),
      freshLen: polylineLength(freshPts),
      usedLen: polylineLength(usedPts),
      freshLast: freshPts[freshPts.length - 1],
      usedLast: usedPts[usedPts.length - 1],
      freshArea,
      ticks,
      xLabels,
    };
  }, [fresh, used, labelWidth, plotW, plotH]);

  useEffect(() => {
    if (!animate || reduce) {
      draw.setValue(1);
      area.setValue(1);
      return;
    }
    draw.setValue(0);
    area.setValue(0);
    Animated.sequence([
      Animated.timing(draw, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(area, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start();
    // Redraw whenever the data changes while the sheet is first shown.
  }, [geometry, animate, reduce, draw, area]);

  if (!geometry) return <View style={{ width, height }} />;

  const freshOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [geometry.freshLen, 0] });
  const usedOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [geometry.usedLen, 0] });

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="freshArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.blue} stopOpacity={0.12} />
            <Stop offset="1" stopColor={C.blue} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {geometry.ticks.map((tick, i) => (
          <Line
            key={i}
            x1={labelWidth}
            x2={labelWidth + plotW}
            y1={tick.y}
            y2={tick.y}
            stroke="#E9E9EB"
            strokeWidth={1}
            strokeDasharray="3,4"
          />
        ))}
        {geometry.freshArea ? (
          <AnimatedPath d={geometry.freshArea} fill="url(#freshArea)" opacity={area} />
        ) : null}
        {geometry.usedPath ? (
          <AnimatedPath
            d={geometry.usedPath}
            stroke={C.greyLight}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${geometry.usedLen}, ${geometry.usedLen}`}
            strokeDashoffset={usedOffset}
          />
        ) : null}
        {geometry.freshPath ? (
          <AnimatedPath
            d={geometry.freshPath}
            stroke={C.blue}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${geometry.freshLen}, ${geometry.freshLen}`}
            strokeDashoffset={freshOffset}
          />
        ) : null}
        {geometry.usedLast ? (
          <Circle cx={geometry.usedLast.x} cy={geometry.usedLast.y} r={3} fill={C.greyLight} />
        ) : null}
        {geometry.freshLast ? (
          <Circle cx={geometry.freshLast.x} cy={geometry.freshLast.y} r={3} fill={C.blue} />
        ) : null}
      </Svg>
      {geometry.ticks.map((tick, i) => (
        <Text
          key={`t${i}`}
          style={[styles.axisLabel, { fontFamily: fonts.regular, top: tick.y - 7, left: 0, width: labelWidth - 6 }]}
          numberOfLines={1}
        >
          {formatPrice(tick.value, currency)}
        </Text>
      ))}
      {geometry.xLabels.map((label, i) => (
        <Text
          key={`x${i}`}
          style={[
            styles.axisLabel,
            styles.xLabel,
            { fontFamily: fonts.regular, top: top + plotH + 6, left: label.x - wp(24) },
          ]}
          numberOfLines={1}
        >
          {label.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: { position: 'absolute', fontSize: fp(10), color: C.greyLight, textAlign: 'left' },
  xLabel: { width: wp(48), textAlign: 'center' },
});
