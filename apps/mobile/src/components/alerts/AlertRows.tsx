/**
 * Alert list building blocks (spec v3, AL8, AL10, P5, M6):
 * - confirmDeleteAlert: iOS action sheet "Delete this alert?" (AL10).
 * - AlertRow: "2022+ · Only unworn" bold, "EU, Hong Kong · Up to 150.000€" grey, chevron.
 *   Swipe left reveals "Delete"; after confirmation the row collapses and slides out (M6).
 * - SaveCheckButton: black button whose label gives way to a self-drawing check (M6).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PICKER_COLORS as P, SheetNode } from '@/components/PickerSheet';
import { ChevronRightIcon } from '@/components/detail/DetailIcons';
import { useReduceMotion } from '@/components/detail/motion';
import { useTheme } from '@/contexts/ThemeContext';
import { SCREEN_WIDTH } from '@/utils/responsive';

export const RED_TEXT = '#D70015';
const RED = '#FF3B30';
const DELETE_WIDTH = 88;

/** AL10 – resolves true when the user confirmed. */
export function confirmDeleteAlert(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Delete this alert?',
          message: 'You will no longer be notified for it.',
          options: ['Delete alert', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (index) => resolve(index === 0)
      );
      return;
    }
    Alert.alert('Delete this alert?', 'You will no longer be notified for it.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete alert', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function TypeChip({ type }: { type: 'wts' | 'wtb' }) {
  const { fonts } = useTheme();
  const wtb = type === 'wtb';
  return (
    <View style={[styles.typeChip, { backgroundColor: wtb ? '#E4EEFB' : '#E3F5E8' }]}>
      <Text style={[styles.typeChipText, { fontFamily: fonts.bold, color: wtb ? '#3478F6' : '#2FA84F' }]}>
        {wtb ? 'WTB' : 'WTS'}
      </Text>
    </View>
  );
}

export function AlertRow({
  title,
  subtitle,
  chip,
  onPress,
  onDelete,
  isFirst,
}: {
  title: string;
  subtitle: string;
  chip?: 'wts' | 'wtb';
  onPress: () => void;
  /** Called after the user confirmed (AL10); rejects when the server delete failed. */
  onDelete: () => Promise<void>;
  isFirst?: boolean;
}) {
  const { fonts } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const snap = (to: number) => {
    open.current = to !== 0;
    Animated.spring(translateX, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const base = open.current ? -DELETE_WIDTH : 0;
        translateX.setValue(Math.min(0, Math.max(-DELETE_WIDTH * 1.4, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const x = (open.current ? -DELETE_WIDTH : 0) + g.dx;
        snap(x < -DELETE_WIDTH / 2 || g.vx < -0.5 ? -DELETE_WIDTH : 0);
      },
      onPanResponderTerminate: () => snap(open.current ? -DELETE_WIDTH : 0),
    })
  ).current;

  const remove = async () => {
    const confirmed = await confirmDeleteAlert();
    if (!confirmed) {
      snap(0);
      return;
    }
    try {
      await onDelete();
    } catch {
      snap(0);
      Alert.alert('Could not delete the alert', 'Please try again.');
    }
  };

  return (
    <View style={styles.outer}>
      <View style={styles.deleteUnder}>
        <TouchableOpacity style={styles.deleteButton} onPress={remove} accessibilityLabel="Delete alert">
          <Text style={[styles.deleteText, { fontFamily: fonts.semiBold }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View {...responder.panHandlers} style={[styles.rowWrap, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={[styles.row, !isFirst && styles.rowBorder]}
          onPress={() => (open.current ? snap(0) : onPress())}
          activeOpacity={0.6}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={styles.titleRow}>
              {chip ? <TypeChip type={chip} /> : null}
              <Text style={[styles.title, { fontFamily: fonts.bold }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Text style={[styles.subtitle, { fontFamily: fonts.regular }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <ChevronRightIcon size={13} color={P.greyLight} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/**
 * M6 – collapse a deleted row: height to 0 and slide out to the left (≈350 ms).
 * Wrap each row; set `removing` to true after a successful delete, `onRemoved` fires at the end.
 */
export function CollapseOut({
  removing,
  onRemoved,
  children,
}: {
  removing: boolean;
  onRemoved: () => void;
  children: SheetNode;
}) {
  const reduce = useReduceMotion();
  const [h, setH] = useState<number | null>(null);
  const height = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!removing) return;
    if (reduce || h === null) {
      onRemoved();
      return;
    }
    height.setValue(h);
    Animated.parallel([
      Animated.timing(height, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(x, {
        toValue: -SCREEN_WIDTH,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => onRemoved());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removing]);

  return (
    <Animated.View
      onLayout={(e) => {
        if (!removing) setH(e.nativeEvent.layout.height);
      }}
      style={removing && h !== null ? { height, overflow: 'hidden', transform: [{ translateX: x }] } : null}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Black full-width button; when `done` turns true the label gives way to a drawing check (M6). */
export function SaveCheckButton({
  label,
  onPress,
  busy,
  done,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  done?: boolean;
  disabled?: boolean;
}) {
  const { fonts } = useTheme();
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const LEN = 24;

  useEffect(() => {
    if (!done) {
      progress.setValue(0);
      return;
    }
    if (reduce) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [done, reduce, progress]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [LEN, 0] });

  return (
    <TouchableOpacity
      style={[styles.saveButton, (disabled || busy) && !done && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || busy || done}
      activeOpacity={0.85}
    >
      {done ? (
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <AnimatedPath
            d="M4.5 11.5l4.5 4.5 8.5-9"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${LEN}, ${LEN}`}
            strokeDashoffset={offset}
          />
        </Svg>
      ) : (
        <Text style={[styles.saveText, { fontFamily: fonts.semiBold }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  deleteUnder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: RED,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteButton: { width: DELETE_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#FFFFFF', fontSize: 15 },
  rowWrap: { backgroundColor: '#FFFFFF' },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, color: P.text, flexShrink: 1 },
  subtitle: { fontSize: 13, color: P.grey, marginTop: 2 },
  typeChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeChipText: { fontSize: 11 },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveText: { color: '#FFFFFF', fontSize: 16 },
});

