/** CK4d – Report counterfeit: serial, reference, type, who offered it, details, photos. */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PickedReference, ReferenceSheet } from '@/components/checks/CheckPickers';
import {
  BlackButton,
  CheckField,
  CheckScreen,
  FieldLabel,
  InlineError,
} from '@/components/checks/ChecksUI';
import {
  DetailsBox,
  IntroText,
  PhotoPicker,
  ReviewNote,
  useSubmitReport,
} from '@/components/checks/ReportParts';
import { PickerSheet } from '@/components/PickerSheet';
import { UI } from '@/components/market/tokens';
import { FormBox, FormRow } from '@/components/settings/FormRows';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

type CounterfeitType = 'counterfeit' | 'frankenstein' | 'fake_papers';

const TYPES: Array<{ value: CounterfeitType; label: string }> = [
  { value: 'counterfeit', label: 'Counterfeit' },
  { value: 'frankenstein', label: 'Frankenstein' },
  { value: 'fake_papers', label: 'Fake papers' },
];

export default function ReportCounterfeitScreen() {
  const { fonts } = useTheme();
  const [serial, setSerial] = useState('');
  const [reference, setReference] = useState<PickedReference | null>(null);
  const [type, setType] = useState<CounterfeitType>('counterfeit');
  const [offered, setOffered] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'reference' | 'type' | null>(null);
  const { submit, submitting, error } = useSubmitReport('counterfeit');

  const ready = serial.trim().length > 0 && !!reference;

  return (
    <CheckScreen
      title="Report counterfeit"
      footer={
        <BlackButton
          label="Submit report"
          disabled={!ready}
          loading={submitting}
          onPress={() =>
            submit(
              {
                serial: serial.trim(),
                reference: reference?.reference,
                brand: reference?.brand ?? undefined,
                model: reference?.model ?? undefined,
                type,
                who_offered: offered.trim() || undefined,
                details: details.trim() || undefined,
              },
              photos
            )
          }
        />
      }
    >
      <IntroText>
        Report a serial you have seen on a counterfeit, a Frankenstein watch (genuine and
        non-genuine parts) or a watch with fake papers. Reference is required.
      </IntroText>
      <FieldLabel required>Serial number</FieldLabel>
      <CheckField
        value={serial}
        onChangeText={setSerial}
        placeholder="e.g. 3Y0R9842"
        autoCapitalize="characters"
      />
      <View style={{ marginTop: hp(14) }}>
        <FormBox>
          <FormRow
            first
            label="Reference *"
            value={reference?.reference ?? 'Select'}
            onPress={() => setSheet('reference')}
          />
          <FormRow
            label="Type"
            value={TYPES.find((t) => t.value === type)?.label}
            onPress={() => setSheet('type')}
          />
          <View style={styles.offeredRow}>
            <Text style={[styles.offeredLabel, { fontFamily: fonts.medium }]}>Who offered it</Text>
            <TextInput
              value={offered}
              onChangeText={setOffered}
              placeholder="Optional"
              placeholderTextColor={UI.greyLight}
              style={[styles.offeredInput, { fontFamily: fonts.regular }]}
            />
          </View>
        </FormBox>
      </View>
      <FieldLabel>Details</FieldLabel>
      <DetailsBox
        value={details}
        onChange={setDetails}
        placeholder="What is wrong? Dial, movement, case, warranty card, certificate …"
      />
      <PhotoPicker photos={photos} onChange={setPhotos} />
      <ReviewNote />
      {error ? <InlineError message={error} /> : null}

      <ReferenceSheet
        visible={sheet === 'reference'}
        selected={reference?.reference ?? null}
        onClose={() => setSheet(null)}
        onSelect={setReference}
      />
      <PickerSheet<CounterfeitType>
        visible={sheet === 'type'}
        title="Type"
        hideButton
        options={TYPES}
        selected={type}
        onClose={() => setSheet(null)}
        onDone={(v) => v && setType(v)}
      />
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  offeredRow: {
    minHeight: sp(52),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: UI.border,
    gap: wp(12),
  },
  offeredLabel: { fontSize: fp(15), color: UI.text },
  offeredInput: { flex: 1, textAlign: 'right', fontSize: fp(15), color: UI.text },
});
