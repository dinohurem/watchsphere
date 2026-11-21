/** CK4b – Report scammer: phone number with country-code button and a large Details field. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuthStore } from '@watchsphere/shared/stores';

import { CountryCodeButton, CountryCodeSheet } from '@/components/checks/CheckPickers';
import {
  BlackButton,
  CheckField,
  CheckScreen,
  FieldLabel,
  InlineError,
} from '@/components/checks/ChecksUI';
import { DialCountry, defaultDialCountry, deviceRegion } from '@/components/checks/checksModel';
import {
  DetailsBox,
  IntroText,
  ReviewNote,
  useSubmitReport,
} from '@/components/checks/ReportParts';
import { wp } from '@/utils/responsive';

export default function ReportScammerScreen() {
  const user = useAuthStore((s) => s.user);
  const [country, setCountry] = useState<DialCountry>(() =>
    defaultDialCountry(user?.whatsapp_phone, deviceRegion())
  );
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const { submit, submitting, error } = useSubmitReport('scammer');

  const ready = phone.replace(/\D/g, '').length >= 4 && details.trim().length > 0;

  return (
    <CheckScreen
      title="Report scammer"
      footer={
        <BlackButton
          label="Submit report"
          disabled={!ready}
          loading={submitting}
          onPress={() =>
            submit({ country_code: country.dial, phone: phone.trim(), details: details.trim() })
          }
        />
      }
    >
      <IntroText>
        Add a phone number that scammed you or a dealer you know. Select the country code first so
        the number is stored correctly. Describe what happened – our team checks every report.
      </IntroText>
      <FieldLabel>Phone number</FieldLabel>
      <View style={styles.row}>
        <CountryCodeButton country={country} onPress={() => setShowCodes(true)} />
        <CheckField
          style={{ flex: 1 }}
          value={phone}
          onChangeText={setPhone}
          onClear={() => setPhone('')}
          placeholder="6123 4567"
          keyboardType="phone-pad"
        />
      </View>
      <FieldLabel>Details</FieldLabel>
      <DetailsBox
        value={details}
        onChange={setDetails}
        placeholder="Describe what happened: what was agreed, how you paid, when the contact stopped."
        minHeight={180}
      />
      <ReviewNote />
      {error ? <InlineError message={error} /> : null}
      <CountryCodeSheet
        visible={showCodes}
        selected={country.code}
        onClose={() => setShowCodes(false)}
        onSelect={setCountry}
      />
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: wp(8), alignItems: 'center' },
});
