/** CK4 – Report stolen serial. The reporter does not choose a theft category (the team does). */
import React, { useState } from 'react';
import { View } from 'react-native';

import {
  CountrySheet,
  DateSheet,
  PickedReference,
  ReferenceSheet,
} from '@/components/checks/CheckPickers';
import {
  BlackButton,
  CheckField,
  CheckScreen,
  FieldLabel,
  InlineError,
} from '@/components/checks/ChecksUI';
import { DialCountry, formatDay, toIsoDay } from '@/components/checks/checksModel';
import {
  DetailsBox,
  IntroText,
  PhotoPicker,
  ReviewNote,
  useSubmitReport,
} from '@/components/checks/ReportParts';
import { FormBox, FormRow } from '@/components/settings/FormRows';
import { hp } from '@/utils/responsive';

export default function ReportStolenScreen() {
  const [serial, setSerial] = useState('');
  const [reference, setReference] = useState<PickedReference | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [country, setCountry] = useState<DialCountry | null>(null);
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'reference' | 'date' | 'country' | null>(null);
  const { submit, submitting, error } = useSubmitReport('stolen');

  const ready = serial.trim().length > 0 && !!reference;

  return (
    <CheckScreen
      title="Report stolen serial"
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
                date_of_incident: date ? toIsoDay(date) : undefined,
                location: country?.name,
                details: details.trim() || undefined,
              },
              photos
            )
          }
        />
      }
    >
      <IntroText>Reference is required so short serials can be matched correctly.</IntroText>
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
            label="Date of theft"
            value={date ? formatDay(toIsoDay(date)) : 'Select'}
            onPress={() => setSheet('date')}
          />
          <FormRow
            label="Location"
            value={country?.name ?? 'Select'}
            onPress={() => setSheet('country')}
          />
        </FormBox>
      </View>
      <FieldLabel>Details</FieldLabel>
      <DetailsBox
        value={details}
        onChange={setDetails}
        placeholder="What happened? Police report number, if available."
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
      <DateSheet
        visible={sheet === 'date'}
        value={date}
        onClose={() => setSheet(null)}
        onDone={setDate}
      />
      <CountrySheet
        visible={sheet === 'country'}
        selected={country?.code ?? null}
        onClose={() => setSheet(null)}
        onSelect={setCountry}
      />
    </CheckScreen>
  );
}
