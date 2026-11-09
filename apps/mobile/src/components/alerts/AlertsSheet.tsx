/**
 * Alerts bottom sheet (spec v3, AL1–AL10).
 *
 * - list (AL8): alerts of one watch grouped by WTS / WTB, swipe left → delete, "+ New alert".
 * - form (AL1 / AL2 new, AL9 edit): WTS · WTB segmented control, rows Year / Condition /
 *   Location / Target price, black "Save alert" / "Save changes", red "Delete alert" (edit).
 * Pickers (AL3–AL7) open on top of this sheet. Save draws a check, then the sheet closes (M6).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomSheet, PICKER_COLORS as P, SheetButton } from '@/components/PickerSheet';
import { ChevronRightIcon } from '@/components/detail/DetailIcons';
import { useReduceMotion } from '@/components/detail/motion';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';

import {
  AlertDraft,
  AlertType,
  WatchAlert,
  alertSubtitle,
  alertTitle,
  conditionValueLabel,
  defaultDraft,
  deleteAlert,
  draftFromAlert,
  locationValueLabel,
  priceValueLabel,
  saveAlert,
  yearValueLabel,
} from './alertModel';
import {
  ConditionPickerSheet,
  LocationPickerSheet,
  TargetPriceSheet,
  YearPickerSheet,
  countryNameFor,
} from './AlertPickers';
import { AlertRow, CollapseOut, RED_TEXT, SaveCheckButton, confirmDeleteAlert } from './AlertRows';

export type AlertsSheetStart =
  | { mode: 'list' }
  | { mode: 'new'; type?: AlertType }
  | { mode: 'edit'; alert: WatchAlert };

type Picker = 'year' | 'condition' | 'location' | 'price' | null;

export function AlertsSheet({
  visible,
  onClose,
  wsCode,
  alerts,
  start,
  onChanged,
  standalone,
}: {
  visible: boolean;
  onClose: () => void;
  wsCode: string;
  /** Alerts of this watch (used by the list view). */
  alerts: WatchAlert[];
  start: AlertsSheetStart;
  /** Re-fetch alerts after a save / delete. */
  onChanged: () => Promise<void> | void;
  /** Opened from "My alerts" (P5): deleting closes the sheet instead of returning to the list. */
  standalone?: boolean;
}) {
  const { fonts } = useTheme();
  const { currency } = useCurrency();
  const reduce = useReduceMotion();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<WatchAlert | null>(null);
  const [draft, setDraft] = useState<AlertDraft>(() => defaultDraft(wsCode, 'wts', currency));
  const [picker, setPicker] = useState<Picker>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [removing, setRemoving] = useState<string[]>([]);

  const openForm = (alert: WatchAlert | null, type: AlertType = 'wts') => {
    setEditing(alert);
    setDraft(alert ? draftFromAlert(alert) : defaultDraft(wsCode, type, currency));
    setDone(false);
    setBusy(false);
    setMode('form');
  };

  useEffect(() => {
    if (!visible) return;
    setPicker(null);
    setRemoving([]);
    if (start.mode === 'list') {
      setMode('list');
      setEditing(null);
      setDone(false);
    } else if (start.mode === 'edit') {
      openForm(start.alert);
    } else {
      openForm(null, start.type ?? 'wts');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const grouped = useMemo(
    () => ({
      wts: alerts.filter((a) => a.alert_type === 'wts'),
      wtb: alerts.filter((a) => a.alert_type === 'wtb'),
    }),
    [alerts]
  );

  const update = (patch: Partial<AlertDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setBusy(true);
    try {
      await saveAlert(draft, editing?.id);
      await onChanged();
      setDone(true);
      setTimeout(onClose, reduce ? 250 : 650);
    } catch (error) {
      setBusy(false);
      Alert.alert('Could not save the alert', 'Please try again.');
    }
  };

  const handleDeleteFromForm = async () => {
    if (!editing) return;
    const confirmed = await confirmDeleteAlert();
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteAlert(editing.id);
      await onChanged();
      setBusy(false);
      const remaining = alerts.filter((a) => a.id !== editing.id).length;
      if (standalone || remaining === 0) onClose();
      else {
        setEditing(null);
        setMode('list');
      }
    } catch {
      setBusy(false);
      Alert.alert('Could not delete the alert', 'Please try again.');
    }
  };

  const title = mode === 'list' ? 'Alerts' : editing ? 'Edit alert' : 'New alert';

  const renderList = () => (
    <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
      {(['wts', 'wtb'] as const).map((type) =>
        grouped[type].length === 0 ? null : (
          <View key={type} style={{ marginBottom: 14 }}>
            <Text style={[styles.groupHeader, { fontFamily: fonts.semiBold }]}>
              {type.toUpperCase()}
            </Text>
            <View style={styles.box}>
              {grouped[type].map((alert, index) => (
                <CollapseOut
                  key={alert.id}
                  removing={removing.includes(alert.id)}
                  onRemoved={() => {
                    onChanged();
                  }}
                >
                  <AlertRow
                    title={alertTitle(alert)}
                    subtitle={alertSubtitle(alert, countryNameFor)}
                    isFirst={index === 0}
                    onPress={() => openForm(alert)}
                    onDelete={async () => {
                      await deleteAlert(alert.id);
                      setRemoving((prev) => [...prev, alert.id]);
                    }}
                  />
                </CollapseOut>
              ))}
            </View>
          </View>
        )
      )}
    </ScrollView>
  );

  const formRows: { key: Exclude<Picker, null>; label: string; value: string }[] = [
    { key: 'year', label: 'Year', value: yearValueLabel(draft) },
    { key: 'condition', label: 'Condition', value: conditionValueLabel(draft.condition) },
    { key: 'location', label: 'Location', value: locationValueLabel(draft.locations, countryNameFor) },
    { key: 'price', label: 'Target price', value: priceValueLabel(draft) },
  ];

  const renderForm = () => (
    <View>
      <View style={styles.segment}>
        {(['wts', 'wtb'] as const).map((type) => {
          const active = draft.alert_type === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => {
                if (active) return;
                // The price rule means something different per type – start from its default.
                update({ alert_type: type, price_mode: 'any', price_amount: null });
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.segmentText, { fontFamily: active ? fonts.semiBold : fonts.medium }, !active && { color: P.grey }]}
              >
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.box}>
        {formRows.map((row, index) => (
          <TouchableOpacity
            key={row.key}
            style={[styles.formRow, index > 0 && styles.rowBorder]}
            onPress={() => setPicker(row.key)}
            activeOpacity={0.6}
          >
            <Text style={[styles.formLabel, { fontFamily: fonts.medium }]}>{row.label}</Text>
            <Text style={[styles.formValue, { fontFamily: fonts.regular }]} numberOfLines={1}>
              {row.value}
            </Text>
            <ChevronRightIcon size={13} color={P.greyLight} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const footer =
    mode === 'list' ? (
      <SheetButton label="+ New alert" onPress={() => openForm(null, 'wts')} />
    ) : (
      <View>
        <SaveCheckButton
          label={editing ? 'Save changes' : 'Save alert'}
          onPress={handleSave}
          busy={busy}
          done={done}
        />
        {editing ? (
          <TouchableOpacity style={styles.deleteLink} onPress={handleDeleteFromForm} disabled={busy}>
            <Text style={[styles.deleteLinkText, { fontFamily: fonts.semiBold }]}>Delete alert</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} footer={footer}>
      <View style={{ flexShrink: 1 }}>
        {mode === 'list' ? renderList() : renderForm()}

        <YearPickerSheet
          visible={picker === 'year'}
          mode={draft.year_mode}
          year={draft.year}
          month={draft.month}
          onClose={() => setPicker(null)}
          onDone={(year_mode, year, month) => update({ year_mode, year, month })}
        />
        <ConditionPickerSheet
          visible={picker === 'condition'}
          value={draft.condition}
          onClose={() => setPicker(null)}
          onDone={(condition) => update({ condition })}
        />
        <LocationPickerSheet
          visible={picker === 'location'}
          selected={draft.locations}
          onClose={() => setPicker(null)}
          onDone={(locations) => update({ locations })}
        />
        <TargetPriceSheet
          visible={picker === 'price'}
          type={draft.alert_type}
          enabled={draft.price_mode !== 'any' && draft.price_amount !== null}
          amount={draft.price_amount}
          currency={draft.currency}
          onClose={() => setPicker(null)}
          onDone={(enabled, amount, cur) =>
            update({
              price_mode: enabled ? (draft.alert_type === 'wts' ? 'max' : 'min') : 'any',
              price_amount: enabled ? amount : null,
              currency: cur,
            })
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  groupHeader: { fontSize: 12, color: P.grey, marginBottom: 6, marginLeft: 4 },
  box: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECECEF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F4',
    borderRadius: 10,
    padding: 2,
    marginBottom: 14,
  },
  segmentItem: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, color: P.text },
  formRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  formLabel: { fontSize: 15, color: P.text },
  formValue: { flex: 1, fontSize: 15, color: P.grey, textAlign: 'right' },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteLinkText: { fontSize: 16, color: RED_TEXT },
});
