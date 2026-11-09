/**
 * Minimal iOS-style wheel: a snapping vertical list with a highlighted centre band.
 */
import React, { useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { fp } from '@/utils/responsive';

const ITEM_HEIGHT = 36;
const VISIBLE = 5;

export function WheelColumn<T extends string | number>({
  items,
  value,
  onChange,
  disabled,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { fonts } = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    items.findIndex((item) => item.value === value)
  );
  const lastIndex = useRef(index);

  useEffect(() => {
    if (lastIndex.current !== index) {
      lastIndex.current = index;
      ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    }
  }, [index]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    lastIndex.current = next;
    if (items[next] && items[next].value !== value) onChange(items[next].value);
  };

  return (
    <View style={[styles.wrap, disabled && { opacity: 0.35 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.band} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE / 2) }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // Without momentum there is no momentum-end event.
          const v = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(v) < 0.05) settle(e);
        }}
        nestedScrollEnabled
      >
        {items.map((item, i) => {
          const selected = i === index;
          return (
            <View key={String(item.value)} style={styles.item}>
              <Text
                style={[
                  styles.text,
                  { fontFamily: selected ? fonts.semiBold : fonts.regular },
                  !selected && { color: '#AEAEB2' },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, height: ITEM_HEIGHT * VISIBLE, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * Math.floor(VISIBLE / 2),
    height: ITEM_HEIGHT,
    backgroundColor: '#F2F2F4',
    borderRadius: 8,
  },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: fp(17), color: '#1C1C1E' },
});
