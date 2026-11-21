/** CK7 / CK7c – Check links: bracelets of a reference with photo, full links and team notes. */
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { ExpandIcon, InfoCircleIcon, LinksIcon } from '@/components/checks/CheckIcons';
import {
  BlackButton,
  CARD_SHADOW,
  CheckField,
  CheckScreen,
  DatabaseNote,
  Hint,
  InfoCard,
  InlineError,
  ResultCard,
} from '@/components/checks/ChecksUI';
import {
  Bracelet,
  BraceletResult,
  braceletState,
  checkBracelets,
  errorMessage,
  errorStatus,
} from '@/components/checks/checksModel';
import { UI } from '@/components/market/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { fp, hp, sp, wp } from '@/utils/responsive';

function BraceletCard({ bracelet, reference }: { bracelet: Bracelet; reference: string }) {
  const { fonts } = useTheme();
  const photo = bracelet.photo_url || bracelet.photo_thumb_url;
  const open = () => {
    if (!photo) return;
    router.push({
      pathname: '/checks/photo',
      params: {
        url: bracelet.photo_url || photo,
        thumb: bracelet.photo_thumb_url || photo,
        title: `${bracelet.name} · ${reference}`,
        links: bracelet.full_links != null ? String(bracelet.full_links) : '',
      },
    } as never);
  };
  return (
    <View style={[styles.card, CARD_SHADOW]}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <LinksIcon size={sp(18)} color={UI.blue} />
        </View>
        <Text style={[styles.headTitle, { fontFamily: fonts.bold }]}>{bracelet.name}</Text>
      </View>
      {photo ? (
        <TouchableOpacity
          style={styles.photoWrap}
          activeOpacity={0.9}
          onPress={open}
          accessibilityLabel={`${bracelet.name} photo, full screen`}
        >
          <Image
            source={{ uri: bracelet.photo_thumb_url || photo }}
            style={styles.photo}
            resizeMode="contain"
          />
          <View style={styles.expand}>
            <ExpandIcon size={sp(14)} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : null}
      <View style={styles.linksRow}>
        <Text style={[styles.linksLabel, { fontFamily: fonts.regular }]}>Full links</Text>
        <Text style={[styles.linksValue, { fontFamily: fonts.bold }]}>
          {bracelet.full_links ?? '–'}
        </Text>
      </View>
      {bracelet.notes ? (
        <View style={styles.notes}>
          <Text style={[styles.notesLabel, { fontFamily: fonts.medium }]}>Notes</Text>
          <Text style={[styles.notesText, { fontFamily: fonts.regular }]}>{bracelet.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function LinksScreen() {
  const { fonts } = useTheme();
  const [reference, setReference] = useState('');
  const [result, setResult] = useState<BraceletResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const q = reference.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await checkBracelets(q));
    } catch (e) {
      setResult(null);
      setError(
        errorStatus(e) === 404
          ? 'We could not find this reference. Check the number and try again.'
          : errorMessage(e, 'The check did not work. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const state = braceletState(result);

  return (
    <CheckScreen title="Check links">
      <CheckField
        value={reference}
        onChangeText={(t) => {
          setReference(t);
          if (result) setResult(null);
        }}
        onClear={() => {
          setReference('');
          setResult(null);
          setError(null);
        }}
        placeholder="Reference, e.g. 126334"
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={run}
      />
      <Hint>
        Shows the bracelets available for this reference and how many links a full bracelet has.
      </Hint>
      <BlackButton label="Check" onPress={run} loading={loading} disabled={!reference.trim()} />

      <View style={{ marginTop: hp(4) }}>
        {error ? <InlineError message={error} /> : null}

        {result && state === 'cards' ? (
          <>
            <InfoCard>
              <Text style={[styles.refName, { fontFamily: fonts.bold }]}>
                {[result.brand, result.model].filter(Boolean).join(' ') || result.reference}
              </Text>
              <Text style={[styles.refLine, { fontFamily: fonts.regular }]}>
                Reference: {result.reference}
              </Text>
              <Text style={[styles.refLine, { fontFamily: fonts.regular }]}>
                Bracelets: {result.bracelets.map((b) => b.name).join(' · ')}
              </Text>
            </InfoCard>
            {result.bracelets.map((b) => (
              <BraceletCard key={b.id} bracelet={b} reference={result.reference} />
            ))}
          </>
        ) : null}

        {result && state === 'no-data' ? (
          <View style={{ marginTop: hp(14) }}>
            <ResultCard
              tone="grey"
              icon={<InfoCircleIcon size={sp(22)} color={UI.grey} />}
              title="No bracelet data yet"
              text="We will add the bracelet data for this reference soon."
            />
          </View>
        ) : null}
      </View>

      <DatabaseNote />
    </CheckScreen>
  );
}

const styles = StyleSheet.create({
  refName: { fontSize: fp(16), color: UI.text },
  refLine: { fontSize: fp(13), color: UI.grey, marginTop: hp(2) },
  card: {
    marginTop: hp(14),
    backgroundColor: UI.white,
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: UI.border,
    padding: sp(14),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: wp(10) },
  headIcon: {
    width: sp(30),
    height: sp(30),
    borderRadius: sp(15),
    backgroundColor: UI.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontSize: fp(16), color: UI.text },
  photoWrap: {
    marginTop: hp(12),
    height: sp(190),
    borderRadius: sp(12),
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  expand: {
    position: 'absolute',
    right: sp(8),
    bottom: sp(8),
    width: sp(28),
    height: sp(28),
    borderRadius: sp(14),
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linksRow: {
    marginTop: hp(12),
    paddingTop: hp(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: UI.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linksLabel: { fontSize: fp(14), color: UI.grey },
  linksValue: { fontSize: fp(18), color: UI.text },
  notes: {
    marginTop: hp(10),
    paddingTop: hp(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: UI.line,
  },
  notesLabel: { fontSize: fp(12), color: UI.grey },
  notesText: { fontSize: fp(13), lineHeight: fp(19), color: UI.text, marginTop: hp(4) },
});
