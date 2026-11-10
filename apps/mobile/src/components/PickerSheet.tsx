/**
 * Shared picker sheet (redesign spec v3, section 0.1) – every selection window in the app uses it.
 *
 * Bottom sheet with grabber, 22 pt bold title + round grey close button, optional grey subtitle,
 * optional search field, 52 pt rows with a 22 pt circle on the right (selected row: light blue
 * background #E4EEFB + filled blue check circle) and a black full-width button at the bottom.
 *
 * Use `options` for a plain list, or render custom content via `children` (the button and
 * header stay the same).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/contexts/ThemeContext';

export const PICKER_COLORS = {
  text: '#1C1C1E',
  grey: '#8E8E93',
  greyLight: '#AEAEB2',
  border: '#E9E9EB',
  fill: '#F2F2F4',
  blue: '#3478F6',
  blueLight: '#E4EEFB',
};

/**
 * ReactNode without `bigint` – the monorepo resolves two @types/react copies and RN's View
 * rejects the newer ReactNode, so sheet content is typed with this instead.
 */
export type SheetNode =
  | React.ReactElement
  | string
  | number
  | boolean
  | null
  | undefined
  | SheetNode[];

export interface PickerOption<T extends string = string> {
  value: T;
  label: string;
  subtitle?: string;
  /** Rendered left of the label (e.g. an emoji flag). */
  leading?: string;
  /** Grey row style used for "All …" rows. */
  muted?: boolean;
}

interface BaseProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Bottom button label, default "Done". */
  buttonLabel?: string;
  /** Hide the bottom button (selection closes the sheet immediately). */
  hideButton?: boolean;
  searchPlaceholder?: string;
  children?: SheetNode;
}

interface SingleProps<T extends string> extends BaseProps {
  multi?: false;
  options?: PickerOption<T>[];
  selected?: T | null;
  onSelect?: (value: T) => void;
  onDone?: (value: T | null) => void;
}

interface MultiProps<T extends string> extends BaseProps {
  multi: true;
  options: PickerOption<T>[];
  selected: T[];
  onDone: (values: T[]) => void;
}

export type PickerSheetProps<T extends string> = SingleProps<T> | MultiProps<T>;

export function CheckCircle({ checked, size = 22 }: { checked: boolean; size?: number }) {
  if (checked) {
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22">
        <Circle cx={11} cy={11} r={11} fill={PICKER_COLORS.blue} />
        <Path
          d="M6.5 11.2l3 3 6-6.4"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={10.25} stroke="#C7C7CC" strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.closeButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Close"
    >
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d="M1 1l10 10M11 1L1 11" stroke="#3C3C43" strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </TouchableOpacity>
  );
}

/** Bare sheet chrome (grabber, title, close, subtitle). Use for fully custom sheets. */
export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxHeightPercent = 0.88,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: SheetNode;
  footer?: SheetNode;
  maxHeightPercent?: number;
}) {
  const { fonts } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropContainer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={styles.backdrop} />
        </Pressable>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16), maxHeight: `${maxHeightPercent * 100}%` as `${number}%` },
            ]}
          >
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={[styles.title, { fontFamily: fonts.bold }]} numberOfLines={1}>
                {title}
              </Text>
              <CloseButton onPress={onClose} />
            </View>
            {subtitle ? (
              <Text style={[styles.subtitle, { fontFamily: fonts.regular }]}>{subtitle}</Text>
            ) : null}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <View style={styles.body}>{children as any}</View>
            {footer as any}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function SheetButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { fonts } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.button, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={[styles.buttonText, { fontFamily: fonts.semiBold }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PickerSheet<T extends string>(props: PickerSheetProps<T>) {
  const { fonts } = useTheme();
  const { visible, title, subtitle, onClose, buttonLabel, hideButton, searchPlaceholder, children } =
    props;
  const [query, setQuery] = useState('');
  const [single, setSingle] = useState<T | null>(null);
  const [multi, setMulti] = useState<T[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    if (props.multi) setMulti(props.selected);
    else setSingle(props.selected ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const options = props.options ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.muted || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const isSelected = (value: T) => (props.multi ? multi.includes(value) : single === value);

  const toggle = (value: T) => {
    if (props.multi) {
      setMulti((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
      return;
    }
    setSingle(value);
    props.onSelect?.(value);
    if (hideButton) {
      props.onDone?.(value);
      onClose();
    }
  };

  const done = () => {
    if (props.multi) props.onDone(multi);
    else props.onDone?.(single);
    onClose();
  };

  const label =
    buttonLabel ?? (props.multi && multi.length > 0 ? `Done (${multi.length})` : 'Done');

  return (
    <BottomSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={hideButton ? null : <SheetButton label={label} onPress={done} />}
    >
      {searchPlaceholder ? (
        <View style={[styles.search, focused && styles.searchFocused]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={PICKER_COLORS.greyLight}
            style={[styles.searchInput, { fontFamily: fonts.regular }]}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      {children}
      {options.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const selected = isSelected(item.value);
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => toggle(item.value)}
                activeOpacity={0.7}
              >
                <View style={styles.rowTextWrap}>
                  <Text
                    style={[
                      styles.rowLabel,
                      { fontFamily: selected ? fonts.semiBold : fonts.medium },
                      item.muted && !selected && { color: PICKER_COLORS.grey },
                    ]}
                    numberOfLines={1}
                  >
                    {item.leading ? `${item.leading}  ` : ''}
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      style={[styles.rowSubtitle, { fontFamily: fonts.regular }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <CheckCircle checked={selected} />
              </TouchableOpacity>
            );
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdropContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
    marginTop: 8,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, color: PICKER_COLORS.text, flex: 1, marginRight: 12 },
  subtitle: { fontSize: 14, color: PICKER_COLORS.grey, marginTop: 4 },
  body: { marginTop: 14, flexShrink: 1 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PICKER_COLORS.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 40,
    borderRadius: 12,
    backgroundColor: PICKER_COLORS.fill,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchFocused: { borderColor: PICKER_COLORS.blue, backgroundColor: '#FFFFFF' },
  searchInput: { fontSize: 16, color: PICKER_COLORS.text, padding: 0 },
  list: { flexGrow: 0 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: PICKER_COLORS.blueLight },
  rowTextWrap: { flex: 1, paddingVertical: 8, marginRight: 12 },
  rowLabel: { fontSize: 16, color: PICKER_COLORS.text },
  rowSubtitle: { fontSize: 13, color: PICKER_COLORS.grey, marginTop: 2 },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
});
