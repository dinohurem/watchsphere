/** CK3b – Scammer report detail: number, country, chip, free-text details, anonymity note. */
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
  RedChip,
  SectionTitle,
} from '@/components/checks/ChecksUI';
import {
  DealerNumberDetail,
  displayNumber,
  fetchDealerNumber,
} from '@/components/checks/checksModel';
import { Shimmer } from '@/components/market/Shimmer';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { fp, hp, sp } from '@/utils/responsive';

export default function ScammerReportScreen() {
  const { fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useCachedResource<DealerNumberDetail>(`checks:dealer-number:${id}`, () =>
    fetchDealerNumber(String(id))
  );
  const r = report.data;

  return (
    <CheckScreen title="Report" footer={r ? <ContactTeamButton /> : undefined}>
      {report.showSkeleton ? (
        <Shimmer style={{ height: sp(110), borderRadius: sp(16), marginTop: hp(14) }} />
      ) : null}
      {!r && report.error ? <InlineError message="This report is not available." /> : null}
      {r ? (
        <>
          <InfoCard>
            <Text style={[styles.name, { fontFamily: fonts.bold }]}>
              {displayNumber(r.country_code, r.phone)}
            </Text>
            {r.country ? (
              <Text style={[styles.line, { fontFamily: fonts.regular }]}>Country: {r.country}</Text>
            ) : null}
            <RedChip label="Reported as scammer" />
          </InfoCard>
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
            have information about this number.
          </GreyNote>
          <DatabaseNote />
        </>
      ) : null}
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: fp(17), color: UI.text },
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
