/** CK3 / CK5 / CK6 – Check dealer number: scammer, verified dealer, no reports. */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';

import {
  CheckmarkCircleFill,
  InfoCircleIcon,
  WarningTriangleIcon,
} from '@/components/checks/CheckIcons';
import { CountryCodeButton, CountryCodeSheet } from '@/components/checks/CheckPickers';
import {
  BlackButton,
  CARD_SHADOW,
  CheckField,
  CheckScreen,
  DatabaseNote,
  Hint,
  InlineError,
  ResultCard,
} from '@/components/checks/ChecksUI';
import {
  DialCountry,
  PhoneCheckResult,
  checkPhone,
  defaultDialCountry,
  deviceRegion,
  errorMessage,
  formatDayTime,
} from '@/components/checks/checksModel';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

export default function PhoneCheckScreen() {
  const { fonts } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [country, setCountry] = useState<DialCountry>(() =>
    defaultDialCountry(user?.whatsapp_phone, deviceRegion())
  );
  const [number, setNumber] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const [result, setResult] = useState<PhoneCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!number.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await checkPhone(country.dial, number.trim()));
    } catch (e) {
      setResult(null);
      setError(errorMessage(e, 'Enter a valid phone number and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CheckScreen title="Dealer number">
      <View style={styles.inputRow}>
        <CountryCodeButton country={country} onPress={() => setShowCodes(true)} />
        <CheckField
          style={{ flex: 1 }}
          value={number}
          onChangeText={(t) => {
            setNumber(t);
            if (result) setResult(null);
          }}
          onClear={() => {
            setNumber('');
            setResult(null);
            setError(null);
          }}
          placeholder="6123 4567"
          keyboardType="phone-pad"
          returnKeyType="search"
          onSubmitEditing={run}
        />
      </View>
      <Hint>
        Select the country code, then enter the number. Shows if it is verified, has no reports or
        is reported as a scammer in the WatchSphere database.
      </Hint>
      <BlackButton label="Check" onPress={run} loading={loading} disabled={!number.trim()} />

      <View style={{ marginTop: hp(16) }}>
        {error ? <InlineError message={error} /> : null}

        {result?.state === 'scammer' ? (
          <ResultCard
            tone="red"
            icon={<WarningTriangleIcon size={sp(22)} color={UI.redText} />}
            title="Reported as scammer"
            text="This number has been reported as a scammer in the WatchSphere database."
            link={
              result.report_id
                ? {
                    label: 'View reason',
                    onPress: () =>
                      router.push({
                        pathname: '/checks/dealer-number/[id]',
                        params: { id: result.report_id },
                      } as never),
                  }
                : undefined
            }
          />
        ) : null}

        {result?.state === 'verified' ? (
          <View style={[styles.verified, CARD_SHADOW]}>
            <CheckmarkCircleFill size={sp(84)} color={UI.blue} />
            <Text style={[styles.verifiedTitle, { fontFamily: fonts.bold }]}>Verified dealer</Text>
            <Text style={[styles.verifiedText, { fontFamily: fonts.regular }]}>
              This number belongs to a dealer verified in the WatchSphere database.
            </Text>
          </View>
        ) : null}

        {result?.state === 'none' ? (
          <ResultCard
            tone="grey"
            icon={<InfoCircleIcon size={sp(22)} color={UI.grey} />}
            title="No reports"
            text="This number has no scammer reports in the WatchSphere database, but it is not verified either. Trade with the usual care."
            checkedAt={formatDayTime(result.checked_at)}
          />
        ) : null}
      </View>

      <DatabaseNote />

      <CountryCodeSheet
        visible={showCodes}
        selected={country.code}
        onClose={() => setShowCodes(false)}
        onSelect={(c) => {
          setCountry(c);
          setResult(null);
        }}
      />
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', gap: wp(8), alignItems: 'center' },
  verified: {
    backgroundColor: UI.white,
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: 'center',
    paddingVertical: hp(24),
    paddingHorizontal: wp(20),
  },
  verifiedTitle: { fontSize: fp(20), color: UI.blue, marginTop: hp(12) },
  verifiedText: {
    fontSize: fp(14),
    lineHeight: fp(20),
    color: UI.text,
    textAlign: 'center',
    marginTop: hp(6),
  },
});
