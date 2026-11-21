/** CK2 – Check serial number: input, black Check button, one result card, grey database note. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { CheckmarkIcon, ChevronSmall, WarningTriangleIcon } from '@/components/checks/CheckIcons';
import {
  BlackButton,
  CheckField,
  CheckScreen,
  DatabaseNote,
  Hint,
  InlineError,
  ResultCard,
} from '@/components/checks/ChecksUI';
import {
  SerialCheckResult,
  checkSerial,
  errorMessage,
  formatDay,
  formatDayTime,
  matchTitle,
  primaryMatch,
  serialState,
  stolenMatches,
} from '@/components/checks/checksModel';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { hp, sp, wp, fp } from '@/utils/responsive';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

function openReport(id: string) {
  router.push({ pathname: '/checks/serial-report/[id]', params: { id } } as never);
}

export default function SerialCheckScreen() {
  const { fonts } = useTheme();
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<SerialCheckResult | null>(null);
  const [checkedFor, setCheckedFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const value = serial.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await checkSerial(value));
      setCheckedFor(value);
    } catch (e) {
      setResult(null);
      setError(errorMessage(e, 'The check did not work. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const state = result ? serialState(result.matches) : null;
  const checkedAt = result ? formatDayTime(result.checked_at) : '';
  const shown = result?.serial?.trim() || checkedFor;
  const first = result ? primaryMatch(result.matches) : undefined;

  return (
    <CheckScreen title="Serial number">
      <CheckField
        value={serial}
        onChangeText={(t) => {
          setSerial(t);
          if (result) setResult(null);
        }}
        onClear={() => {
          setSerial('');
          setResult(null);
          setError(null);
        }}
        placeholder="Serial number"
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={run}
      />
      <Hint>
        Shows if the serial number is reported as stolen, counterfeit or with fake papers in the
        WatchSphere database.
      </Hint>
      <BlackButton label="Check" onPress={run} loading={loading} disabled={!serial.trim()} />

      <View style={{ marginTop: hp(16) }}>
        {error ? <InlineError message={error} /> : null}

        {state === 'clear' ? (
          <ResultCard
            tone="green"
            icon={<CheckmarkIcon size={sp(22)} color={UI.greenText} />}
            title="No reports"
            text={`${shown} is not reported as stolen, counterfeit or with fake papers in the WatchSphere database.`}
            checkedAt={checkedAt}
          />
        ) : null}

        {state === 'stolen-single' && first ? (
          <ResultCard
            tone="red"
            icon={<WarningTriangleIcon size={sp(22)} color={UI.redText} />}
            title="Reported as stolen"
            text="This watch has been reported as stolen in the WatchSphere database."
            link={{ label: 'View report', onPress: () => openReport(first.id) }}
          />
        ) : null}

        {state === 'stolen-multi' && result ? (
          <ResultCard
            tone="red"
            icon={<WarningTriangleIcon size={sp(22)} color={UI.redText} />}
            title="Reported as stolen"
            text={`A watch with serial ${shown} is reported in the WatchSphere database. Compare the reference with the watch in front of you.`}
          >
            <View style={styles.divider} />
            {stolenMatches(result.matches).map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.matchRow}
                activeOpacity={0.7}
                onPress={() => openReport(m.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.matchTitle, { fontFamily: fonts.semiBold }]} numberOfLines={1}>
                    {matchTitle(m)}
                  </Text>
                  <Text style={[styles.matchSub, { fontFamily: fonts.regular }]}>
                    {[
                      m.reported_at ? `Reported ${formatDay(m.reported_at)}` : '',
                      m.location ?? '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <ChevronSmall size={sp(12)} color={UI.greyLight} />
              </TouchableOpacity>
            ))}
          </ResultCard>
        ) : null}

        {state === 'counterfeit' && first ? (
          <ResultCard
            tone="red"
            icon={<WarningTriangleIcon size={sp(22)} color={UI.redText} />}
            title="Reported as counterfeit"
            text="This serial number has been seen on a counterfeit or Frankenstein watch and is reported in the WatchSphere database."
            secondary="A genuine watch with this serial also exists. This does not mean the watch in front of you is fake – but check it with extra care."
            link={{ label: 'View report', onPress: () => openReport(first.id) }}
          />
        ) : null}

        {state === 'fake-papers' && first ? (
          <ResultCard
            tone="red"
            icon={<WarningTriangleIcon size={sp(22)} color={UI.redText} />}
            title="Reported with fake papers"
            text="This serial number has been seen with fake papers (warranty card or certificate) and is reported in the WatchSphere database."
            secondary="This does not mean the watch or its papers are fake – but check the warranty card and certificate with extra care."
            link={{ label: 'View report', onPress: () => openReport(first.id) }}
          />
        ) : null}
      </View>

      <DatabaseNote />
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: UI.line,
    marginTop: hp(12),
    marginBottom: hp(4),
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: hp(8), gap: wp(8) },
  matchTitle: { fontSize: fp(14), color: UI.text },
  matchSub: { fontSize: fp(12), color: UI.grey, marginTop: hp(2) },
});
