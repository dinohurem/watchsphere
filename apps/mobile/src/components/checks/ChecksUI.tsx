/**
 * Shared building blocks of the Checks screens (spec addendum, section 1): screen shell with the
 * push header, grey input field, black button, result card, grey database note, "Contact
 * WatchSphere team" button and the Support-style WhatsApp opener.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { UI } from '@/components/market/tokens';
import type { SheetNode } from '@/components/PickerSheet';
import { SettingsHeader } from '@/components/settings/FormRows';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { InfoCircleIcon, XmarkCircleIcon } from './CheckIcons';
import { fetchChecksConfig } from './checksModel';

export const DB_NOTE =
  "Checks use WatchSphere's internal database only. Other databases are not included. Use this as an extra safety step, not as proof.";

/** Soft shadow used on cards. */
export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

// ---------------------------------------------------------------------------------------------
// Screen shell
// ---------------------------------------------------------------------------------------------

export function CheckScreen({
  title,
  children,
  footer,
}: {
  title: string;
  children: SheetNode;
  /** Pinned below the scroll area (e.g. the black submit button). */
  footer?: SheetNode;
}) {
  return (
    <View style={styles.screen}>
      <SettingsHeader title={title} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {children as any}
        </ScrollView>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {footer ? <View style={styles.footer}>{footer as any}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Inputs and buttons
// ---------------------------------------------------------------------------------------------

/** Grey search-style field with a clear (x) button (same look as the Market search). */
export function CheckField({
  value,
  onChangeText,
  onClear,
  leading,
  style,
  ...rest
}: TextInputProps & {
  value: string;
  onChangeText: (t: string) => void;
  onClear?: () => void;
  leading?: SheetNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { fonts } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused, style]}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {leading ? (leading as any) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={UI.greyLight}
        style={[styles.fieldInput, { fontFamily: fonts.regular }]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        {...rest}
      />
      {value.length > 0 && onClear ? (
        <TouchableOpacity onPress={onClear} hitSlop={10} accessibilityLabel="Clear">
          <XmarkCircleIcon size={sp(18)} color={UI.greyLight} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  const { fonts } = useTheme();
  return (
    <Text style={[styles.fieldLabel, { fontFamily: fonts.medium }]}>
      {children}
      {required ? ' *' : ''}
    </Text>
  );
}

export function Hint({ children }: { children: string }) {
  const { fonts } = useTheme();
  return <Text style={[styles.hint, { fontFamily: fonts.regular }]}>{children}</Text>;
}

/** Black full-width button ("Check", "Submit report", "Done"). */
export function BlackButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { fonts } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.blackButton, (disabled || loading) && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.blackButtonText, { fontFamily: fonts.semiBold }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------------------------
// Result cards and notes
// ---------------------------------------------------------------------------------------------

export type Tone = 'green' | 'red' | 'grey';

const TONE: Record<Tone, { circle: string; title: string }> = {
  green: { circle: UI.greenLight, title: UI.greenText },
  red: { circle: '#FDE7E9', title: UI.redText },
  grey: { circle: UI.fill, title: UI.text },
};

export function ResultCard({
  tone,
  icon,
  title,
  text,
  secondary,
  checkedAt,
  link,
  children,
}: {
  tone: Tone;
  icon: SheetNode;
  title: string;
  text?: string;
  secondary?: string;
  checkedAt?: string;
  link?: { label: string; onPress: () => void };
  children?: SheetNode;
}) {
  const { fonts } = useTheme();
  return (
    <View style={[styles.card, CARD_SHADOW]}>
      <View style={styles.resultHead}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <View style={[styles.resultCircle, { backgroundColor: TONE[tone].circle }]}>{icon as any}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultTitle, { fontFamily: fonts.bold, color: TONE[tone].title }]}>
            {title}
          </Text>
          {text ? (
            <Text style={[styles.resultText, { fontFamily: fonts.regular }]}>{text}</Text>
          ) : null}
          {secondary ? (
            <Text style={[styles.resultSecondary, { fontFamily: fonts.regular }]}>{secondary}</Text>
          ) : null}
          {link ? (
            <TouchableOpacity onPress={link.onPress} hitSlop={8} style={{ marginTop: hp(8) }}>
              <Text style={[styles.link, { fontFamily: fonts.semiBold }]}>{link.label} ›</Text>
            </TouchableOpacity>
          ) : null}
          {checkedAt ? (
            <Text style={[styles.checkedAt, { fontFamily: fonts.regular }]}>Checked {checkedAt}</Text>
          ) : null}
        </View>
      </View>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children ? (children as any) : null}
    </View>
  );
}

/** Grey database note under every check screen. */
export function DatabaseNote({ text = DB_NOTE }: { text?: string }) {
  const { fonts } = useTheme();
  return (
    <View style={styles.note}>
      <InfoCircleIcon size={sp(15)} color={UI.grey} />
      <Text style={[styles.noteText, { fontFamily: fonts.regular }]}>{text}</Text>
    </View>
  );
}

export function GreyNote({ children }: { children: string }) {
  const { fonts } = useTheme();
  return <Text style={[styles.greyNote, { fontFamily: fonts.regular }]}>{children}</Text>;
}

/** White card with a bold title and grey lines ("Rolex Daytona / Reference: …"). */
export function InfoCard({ children }: { children: SheetNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <View style={[styles.card, CARD_SHADOW, { marginTop: hp(14) }]}>{children as any}</View>;
}

export function RedChip({ label }: { label: string }) {
  const { fonts } = useTheme();
  return (
    <View style={styles.redChip}>
      <Text style={[styles.redChipText, { fontFamily: fonts.semiBold }]}>{label}</Text>
    </View>
  );
}

export function LabelRows({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const { fonts } = useTheme();
  const shown = rows.filter(([, v]) => !!v);
  return (
    <View style={[styles.card, CARD_SHADOW, { paddingVertical: 0, marginTop: hp(12) }]}>
      {shown.map(([label, value], i) => (
        <View key={label} style={[styles.labelRow, i > 0 && styles.labelRowBorder]}>
          <Text style={[styles.labelRowLabel, { fontFamily: fonts.regular }]}>{label}</Text>
          <Text style={[styles.labelRowValue, { fontFamily: fonts.medium }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { fonts } = useTheme();
  return <Text style={[styles.sectionTitle, { fontFamily: fonts.semiBold }]}>{children}</Text>;
}

// ---------------------------------------------------------------------------------------------
// Contact WatchSphere team (opens WhatsApp the way Support does)
// ---------------------------------------------------------------------------------------------

const ENV_WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || '';

export function useTeamWhatsApp(): string {
  const [number, setNumber] = useState(ENV_WHATSAPP);
  useEffect(() => {
    let alive = true;
    fetchChecksConfig()
      .then((c) => {
        if (alive && c.support_whatsapp) setNumber(c.support_whatsapp);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return number;
}

export function ContactTeamButton({ context }: { context?: string }) {
  const number = useTeamWhatsApp();
  const open = async () => {
    const digits = (number || ENV_WHATSAPP).replace(/[^0-9]/g, '');
    if (!digits) {
      Alert.alert('WhatsApp', 'The team number is not available right now.');
      return;
    }
    const text = context ? `?text=${encodeURIComponent(context)}` : '';
    try {
      await Linking.openURL(`https://wa.me/${digits}${text}`);
    } catch {
      Alert.alert('WhatsApp', 'Could not open WhatsApp');
    }
  };
  return <BlackButton label="Contact WatchSphere team" onPress={open} />;
}

// ---------------------------------------------------------------------------------------------
// Result-area states
// ---------------------------------------------------------------------------------------------

export function InlineError({ message }: { message: string }) {
  const { fonts } = useTheme();
  return (
    <View style={styles.errorBox}>
      <Text style={[styles.errorText, { fontFamily: fonts.medium }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.white },
  content: { paddingHorizontal: wp(16), paddingTop: hp(8), paddingBottom: hp(32) },
  footer: { paddingHorizontal: wp(16), paddingTop: hp(8), paddingBottom: hp(24), gap: hp(8) },
  field: {
    minHeight: sp(46),
    borderRadius: sp(14),
    backgroundColor: UI.fill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(14),
    gap: wp(8),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldFocused: { borderColor: UI.blue, backgroundColor: UI.white },
  fieldInput: { flex: 1, fontSize: fp(16), color: UI.text, paddingVertical: hp(10) },
  fieldLabel: { fontSize: fp(12), color: UI.grey, marginBottom: hp(6), marginTop: hp(14) },
  hint: { fontSize: fp(12), lineHeight: fp(17), color: UI.grey, marginTop: hp(8), marginBottom: hp(14) },
  blackButton: {
    height: sp(52),
    borderRadius: sp(26),
    backgroundColor: UI.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackButtonText: { fontSize: fp(16), color: '#FFFFFF' },
  card: {
    backgroundColor: UI.white,
    borderRadius: sp(16),
    padding: sp(14),
    borderWidth: 1,
    borderColor: UI.border,
  },
  resultHead: { flexDirection: 'row', gap: wp(12) },
  resultCircle: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontSize: fp(17), marginTop: hp(1) },
  resultText: { fontSize: fp(14), lineHeight: fp(20), color: UI.text, marginTop: hp(4) },
  resultSecondary: { fontSize: fp(13), lineHeight: fp(18), color: UI.grey, marginTop: hp(8) },
  checkedAt: { fontSize: fp(12), color: UI.grey, marginTop: hp(8) },
  link: { fontSize: fp(14), color: UI.blue },
  note: {
    flexDirection: 'row',
    gap: wp(8),
    backgroundColor: UI.fill,
    borderRadius: sp(12),
    padding: sp(12),
    marginTop: hp(16),
  },
  noteText: { flex: 1, fontSize: fp(12), lineHeight: fp(17), color: UI.grey },
  greyNote: { fontSize: fp(12), lineHeight: fp(17), color: UI.grey, marginTop: hp(10) },
  redChip: {
    alignSelf: 'flex-start',
    marginTop: hp(8),
    paddingHorizontal: wp(10),
    paddingVertical: sp(3),
    borderRadius: sp(10),
    backgroundColor: '#FDE7E9',
  },
  redChipText: { fontSize: fp(12), color: UI.redText },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(13),
    gap: wp(12),
  },
  labelRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.line },
  labelRowLabel: { fontSize: fp(14), color: UI.grey },
  labelRowValue: { flexShrink: 1, fontSize: fp(14), color: UI.text, textAlign: 'right' },
  sectionTitle: { fontSize: fp(13), color: UI.grey, marginTop: hp(18), marginBottom: hp(6) },
  errorBox: {
    marginTop: hp(14),
    padding: sp(12),
    borderRadius: sp(12),
    backgroundColor: '#FDE7E9',
  },
  errorText: { fontSize: fp(13), color: UI.redText },
});
