/**
 * Shared parts of the three report forms (CK4 / CK4b / CK4d): details box, dashed photo upload,
 * the review note and the submit flow that ends on CK4e.
 */
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

import { UploadIcon } from './CheckIcons';
import { ReportKind, SubmittedReport, errorMessage, submitReport, uploadReportPhoto } from './checksModel';
import { FieldLabel, GreyNote } from './ChecksUI';

export const REVIEW_NOTE =
  'Reports are checked by the WatchSphere team before they appear in Checks. False reports lead to account suspension.';

export function DetailsBox({
  value,
  onChange,
  placeholder,
  minHeight = 110,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  minHeight?: number;
}) {
  const { fonts } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={UI.greyLight}
      multiline
      textAlignVertical="top"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.details,
        { fontFamily: fonts.regular, minHeight: sp(minHeight) },
        focused && styles.detailsFocused,
      ]}
    />
  );
}

/** Dashed "Add photos or documents (optional)" button with thumbnails. */
export function PhotoPicker({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (uris: string[]) => void;
}) {
  const { fonts } = useTheme();
  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, 6 - photos.length),
    });
    if (!result.canceled) onChange([...photos, ...result.assets.map((a) => a.uri)].slice(0, 6));
  };
  return (
    <View>
      <TouchableOpacity style={styles.dashed} onPress={pick} activeOpacity={0.7}>
        <UploadIcon size={sp(18)} color={UI.blue} />
        <Text style={[styles.dashedText, { fontFamily: fonts.medium }]}>
          Add photos or documents (optional)
        </Text>
      </TouchableOpacity>
      {photos.length > 0 ? (
        <View style={styles.thumbs}>
          {photos.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => onChange(photos.filter((p) => p !== uri))}
                accessibilityLabel="Remove photo"
              >
                <Text style={styles.thumbRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ReviewNote() {
  return <GreyNote>{REVIEW_NOTE}</GreyNote>;
}

export function IntroText({ children }: { children: string }) {
  const { fonts } = useTheme();
  return <Text style={[styles.intro, { fontFamily: fonts.regular }]}>{children}</Text>;
}

export { FieldLabel };

/**
 * Uploads the photos, posts the report and opens CK4e. Returns a submit function and its state.
 */
export function useSubmitReport(kind: ReportKind) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (payload: Record<string, unknown>, photos: string[] = []) => {
    setSubmitting(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const uri of photos) {
        const url = await uploadReportPhoto(uri);
        if (url) urls.push(url);
      }
      const body = kind === 'scammer' ? payload : { ...payload, photo_urls: urls };
      const report: SubmittedReport = await submitReport(kind, body);
      router.replace({
        pathname: '/checks/report/submitted',
        params: { summary: report.summary, subtitle: report.subtitle },
      } as never);
    } catch (e) {
      setError(errorMessage(e, 'The report could not be sent. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error };
}

const styles = StyleSheet.create({
  details: {
    borderRadius: sp(14),
    backgroundColor: UI.fill,
    paddingHorizontal: wp(14),
    paddingTop: hp(12),
    paddingBottom: hp(12),
    fontSize: fp(15),
    color: UI.text,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  detailsFocused: { borderColor: UI.blue, backgroundColor: UI.white },
  dashed: {
    marginTop: hp(14),
    height: sp(46),
    borderRadius: sp(12),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: UI.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(8),
  },
  dashedText: { fontSize: fp(14), color: UI.blue },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(8), marginTop: hp(10) },
  thumbWrap: { width: sp(64), height: sp(64) },
  thumb: { width: '100%', height: '100%', borderRadius: sp(10), backgroundColor: UI.fill },
  thumbRemove: {
    position: 'absolute',
    top: -sp(6),
    right: -sp(6),
    width: sp(20),
    height: sp(20),
    borderRadius: sp(10),
    backgroundColor: UI.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#FFFFFF', fontSize: fp(13), lineHeight: fp(15) },
  intro: { fontSize: fp(12), lineHeight: fp(17), color: UI.grey, marginTop: hp(4) },
});
