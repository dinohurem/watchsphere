/**
 * SheetModal - the one bottom-sheet presentation primitive for the whole app.
 *
 * Every bottom sheet (pickers, alerts, price trend, offer, filters ...) is rendered through this
 * component so they all open, look and close the same way:
 *  - the dim backdrop FADES in/out while the sheet SLIDES up/down (RN's own Modal "slide" would
 *    drag the backdrop along with the sheet, which is what made the overlay look odd);
 *  - the sheet is pinned to the bottom edge of the screen and pads its content for the home
 *    indicator, so there is never an empty strip below it;
 *  - the keyboard lifts the sheet (no KeyboardAvoidingView: its frame measurement during a Modal
 *    transition left a gap under the sheet);
 *  - Reduce Motion replaces the slide with a plain cross-fade.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SHEET_RADIUS = 24;
const OPEN_MS = 320;
const CLOSE_MS = 240;
const REDUCED_MS = 160;
const BACKDROP = 'rgba(0,0,0,0.35)';

/** Same type as PickerSheet's SheetNode (the monorepo resolves two @types/react copies). */
type SheetChildren =
  | React.ReactElement
  | string
  | number
  | boolean
  | null
  | undefined
  | SheetChildren[];

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: SheetChildren;
  /** Extra style for the white sheet (e.g. horizontal padding, maxHeight). */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Cap on the sheet height as a fraction of the window height. Default 0.88. */
  maxHeightPercent?: number;
  /** Space kept under the content when there is no home indicator inset. Default 16. */
  minBottomPadding?: number;
  /** Backdrop tap closes the sheet. Default true. */
  dismissOnBackdrop?: boolean;
}

export function SheetModal({
  visible,
  onClose,
  children,
  sheetStyle,
  maxHeightPercent = 0.88,
  minBottomPadding = 16,
  dismissOnBackdrop = true,
}: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(windowHeight);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const finishClose = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: reduceMotion ? REDUCED_MS : OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
    } else if (mounted) {
      progress.value = withTiming(
        0,
        { duration: reduceMotion ? REDUCED_MS : CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;
    return {
      opacity: reduceMotion ? progress.value : 1,
      transform: [
        { translateY: reduceMotion ? 0 : (1 - progress.value) * (sheetHeight.value + 40) },
      ],
      // The keyboard covers the home indicator, so the inset padding is dropped while it is up.
      paddingBottom: kb > 0 ? minBottomPadding : Math.max(insets.bottom, minBottomPadding),
      bottom: kb,
    };
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissOnBackdrop ? onClose : undefined}
            accessibilityLabel="Close"
            accessible={false}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight: windowHeight * maxHeightPercent },
            sheetStyle,
            sheetAnimatedStyle,
          ]}
          onLayout={(e) => {
            sheetHeight.value = e.nativeEvent.layout.height;
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {children as any}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: BACKDROP },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
  },
});
