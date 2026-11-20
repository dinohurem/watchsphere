/** CK2d – Serial report detail (published reports only; the reporter is never shown). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  CARD_SHADOW,
  CheckScreen,
  ContactTeamButton,
  DatabaseNote,
  GreyNote,
  InfoCard,
  InlineError,
  LabelRows,
  RedChip,
  SectionTitle,
} from '@/components/checks/ChecksUI';
import { SerialReportDetail, fetchSerialReport, formatDay } from '@/components/checks/checksModel';
import { Shimmer } from '@/components/market/Shimmer';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { fp, hp, sp } from '@/utils/responsive';

const CHIP: Record<string, string> = {
  stolen: 'Reported as stolen',
  counterfeit: 'Reported as counterfeit',
  frankenstein: 'Reported as Frankenstein',
  fake_papers: 'Reported with fake papers',
};

export default function SerialReportScreen() {
  const { fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useCachedResource<SerialReportDetail>(`checks:serial-report:${id}`, () =>
    fetchSerialReport(String(id))
  );
  const r = report.data;

  return (
    <CheckScreen title="Report" footer={r ? <ContactTeamButton /> : undefined}>
      {report.showSkeleton ? (
        <View style={{ gap: hp(12), marginTop: hp(14) }}>
          <Shimmer style={{ height: sp(92), borderRadius: sp(16) }} />
          <Shimmer style={{ height: sp(150), borderRadius: sp(16) }} />
        </View>
      ) : null}
      {!r && report.error ? <InlineError message="This report is not available." /> : null}
      {r ? (
        <>
          <InfoCard>
            <Text style={[styles.name, { fontFamily: fonts.bold }]}>
              {[r.brand, r.model].filter(Boolean).join(' ') || 'Reported watch'}
            </Text>
            {r.reference ? (
              <Text style={[styles.line, { fontFamily: fonts.regular }]}>
                Reference: {r.reference}
              </Text>
            ) : null}
            <Text style={[styles.line, { fontFamily: fonts.regular }]}>Serial: {r.serial}</Text>
            <RedChip label={CHIP[r.type] ?? 'Reported'} />
          </InfoCard>
          <LabelRows
            rows={[
              ['How', r.how_stolen_label],
              ['Date of theft', formatDay(r.date_of_incident)],
              ['Location', r.location],
              ['Reported on', formatDay(r.reported_at)],
            ]}
          />
          {r.details ? (
            <>
              <SectionTitle>Details</SectionTitle>
              <View style={[styles.detailsCard, CARD_SHADOW]}>
                <Text style={[styles.details, { fontFamily: fonts.regular }]}>{r.details}</Text>
              </View>
            </>
          ) : null}
          <GreyNote>
            The reporter's identity is not shown. The WatchSphere team can put you in contact if you
            have information about this watch.
          </GreyNote>
          <DatabaseNote />
        </>
      ) : null}
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: fp(16), color: UI.text },
  line: { fontSize: fp(13), color: UI.grey, marginTop: hp(2) },
  detailsCard: {
    backgroundColor: UI.white,
    borderRadius: sp(16),
    padding: sp(14),
    borderWidth: 1,
    borderColor: UI.border,
  },
  details: { fontSize: fp(14), lineHeight: fp(20), color: UI.text },
});
