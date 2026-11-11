/**
 * Market overview (redesign spec v3, section 4 – M2 … M10).
 *
 * Header: WS logo + search bar. Brand tabs (All · Rolex · …). With "All" a single
 * "Show: Top movers ▾" button (six signals, last month); with a brand the
 * Collection → Model → Reference buttons. 2-column card grid, no prices, no badges.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/market/AppHeader';
import { BrandTabs } from '@/components/market/BrandTabs';
import { FilterButton } from '@/components/market/FilterButton';
import { MarketCard, MarketCardSkeleton } from '@/components/market/MarketCard';
import { SkeletonCrossFade } from '@/components/market/Shimmer';
import { StaggerIn, useFirstAppearance } from '@/components/market/StaggerIn';
import { UI } from '@/components/market/tokens';
import { MarketCardData, toCards } from '@/components/market/types';
import { PickerOption, PickerSheet } from '@/components/PickerSheet';
import { SubscriptionOverlay } from '@/components/SubscriptionOverlay';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { api } from '@/services/api';
import { fp, hp, sp, wp, SCREEN_WIDTH } from '@/utils/responsive';

const PAGE_SIZE = 40;
const H_PADDING = wp(16);
const GAP = wp(12);
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GAP) / 2;

type Signal =
  'top_movers' | 'most_requested' | 'rising' | 'falling' | 'above_retail' | 'below_retail';
type Direction = 'most' | 'least';

/** M2.1 – fixed order and subtitles. */
const SIGNALS: PickerOption<Signal>[] = [
  { value: 'top_movers', label: 'Top movers', subtitle: 'Hot this month' },
  { value: 'most_requested', label: 'Most requested', subtitle: 'Highest demand' },
  { value: 'rising', label: 'Rising', subtitle: 'Biggest price increase' },
  { value: 'falling', label: 'Falling', subtitle: 'Biggest price drop' },
  { value: 'above_retail', label: 'Above retail', subtitle: 'Premium over retail' },
  { value: 'below_retail', label: 'Below retail', subtitle: 'Discount to retail' },
];

const ALL = '__all__';

type Sheet = 'show' | 'collection' | 'model' | 'reference' | null;

interface CollectionFacet {
  collection: string;
  model_count: number;
}

interface CardsPage {
  items: MarketCardData[];
  total: number;
}

export default function MarketScreen() {
  const { fonts } = useTheme();
  const [brand, setBrand] = useState<string | null>(null);
  const [signal, setSignal] = useState<Signal>('top_movers');
  const [direction, setDirection] = useState<Direction>('most');
  const [collection, setCollection] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const [collections, setCollections] = useState<CollectionFacet[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);

  const [extra, setExtra] = useState<MarketCardData[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Brand tab row
  const brandTabs = useCachedResource<string[]>('market:brand-tabs', async () => {
    const res = await api.get('/market/brand-tabs');
    const list = Array.isArray(res.data) ? res.data : res.data?.items;
    return Array.isArray(list) ? list.map(String) : [];
  });

  // Query for the card grid
  const params = useMemo(() => {
    const p: Record<string, string | number> = { limit: PAGE_SIZE };
    if (brand) {
      p.brand = brand;
      if (collection) p.collection = collection;
      if (model) p.model = model;
      if (reference) p.reference = reference;
    } else {
      p.signal = signal;
      if (signal === 'above_retail' || signal === 'below_retail') p.direction = direction;
    }
    return p;
  }, [brand, collection, model, reference, signal, direction]);
  const cacheKey = `market:cards:${JSON.stringify(params)}`;

  const cards = useCachedResource<CardsPage>(cacheKey, async () => {
    const res = await api.get('/market/cards', { params: { ...params, offset: 0 } });
    return { items: toCards(res.data), total: Number(res.data?.total ?? 0) };
  });

  useEffect(() => {
    setExtra([]);
  }, [cacheKey]);

  const items = useMemo(() => [...(cards.data?.items ?? []), ...extra], [cards.data, extra]);
  const total = cards.data?.total ?? 0;
  const animateEntrance = useFirstAppearance('market', !!cards.data);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cards.data || items.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/market/cards', {
        params: { ...params, offset: items.length },
      });
      const next = toCards(res.data);
      setExtra((prev) => [...prev, ...next]);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, cards.data, items.length, total, params]);

  // Facets
  useEffect(() => {
    setCollections([]);
    if (!brand) return;
    let cancelled = false;
    api
      .get('/market/facets/collections', { params: { brand } })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setCollections(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brand]);

  useEffect(() => {
    setModels([]);
    if (!brand || !collection) return;
    let cancelled = false;
    api
      .get('/market/facets/models', { params: { brand, collection } })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setModels(res.data.map(String));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brand, collection]);

  useEffect(() => {
    setReferences([]);
    if (!brand || !collection) return;
    let cancelled = false;
    const p: Record<string, string> = { brand, collection };
    if (model) p.model = model;
    api
      .get('/market/facets/references', { params: p })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setReferences(res.data.map(String));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brand, collection, model]);

  const selectBrand = (next: string | null) => {
    setBrand(next);
    setCollection(null);
    setModel(null);
    setReference(null);
  };

  // M9 rule: Model button only if the collection has more than one distinct model.
  const showModelButton = !!collection && models.length > 1;
  const isRetailSignal = signal === 'above_retail' || signal === 'below_retail';
  const signalLabel = SIGNALS.find((s) => s.value === signal)?.label ?? 'Top movers';
  const brandCollection = [brand, collection].filter(Boolean).join(' ');

  const header = <AppHeader search profile={false} />;

  const renderFilters = () => {
    if (!brand) {
      return (
        <View style={styles.filterRow}>
          <FilterButton label="Show" value={signalLabel} onPress={() => setSheet('show')} />
          {isRetailSignal ? (
            <DirectionToggle
              signal={signal}
              direction={direction}
              onChange={setDirection}
              fonts={fonts}
            />
          ) : null}
        </View>
      );
    }
    if (showModelButton) {
      // Compact form (M9): Day-Date ▾ · 40 ▾ · All refs ▾
      return (
        <View style={styles.filterRow}>
          <FilterButton
            value={collection ?? 'All collections'}
            dark
            onPress={() => setSheet('collection')}
          />
          <FilterButton
            value={model ? shortModel(model, collection) : 'All models'}
            dark={!!model}
            onPress={() => setSheet('model')}
          />
          <FilterButton
            value={reference ?? 'All refs'}
            dark={!!reference}
            onPress={() => setSheet('reference')}
          />
        </View>
      );
    }
    return (
      <View style={styles.filterRow}>
        <FilterButton
          label="Collection"
          value={collection ?? 'All collections'}
          onPress={() => setSheet('collection')}
        />
        {collection ? (
          <FilterButton
            label="Reference"
            value={reference ?? 'All refs'}
            onPress={() => setSheet('reference')}
          />
        ) : null}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: MarketCardData; index: number }) => (
    <StaggerIn index={index} animate={animateEntrance}>
      <MarketCard card={item} width={CARD_WIDTH} />
    </StaggerIn>
  );

  return (
    <SubscriptionOverlay feature="market" header={header}>
      <View style={styles.container}>
        <BrandTabs brands={brandTabs.data ?? []} selected={brand} onSelect={selectBrand} />
        {renderFilters()}
        <SkeletonCrossFade
          loading={cards.showSkeleton}
          style={styles.fadeBox}
          skeleton={
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <MarketCardSkeleton key={i} width={CARD_WIDTH} />
              ))}
            </View>
          }
        >
          <FlatList
            data={items}
            keyExtractor={(item, i) => `${item.id}-${i}`}
            numColumns={2}
            renderItem={renderItem}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            refreshControl={
              <RefreshControl
                refreshing={cards.refreshing}
                onRefresh={() => {
                  setExtra([]);
                  cards.refresh();
                }}
              />
            }
            ListEmptyComponent={
              cards.loading ? null : (
                <Text style={[styles.empty, { fontFamily: fonts.regular }]}>No watches found</Text>
              )
            }
          />
        </SkeletonCrossFade>

        <PickerSheet<Signal>
          visible={sheet === 'show'}
          title="Show"
          subtitle="All brands · last month"
          options={SIGNALS}
          selected={signal}
          onClose={() => setSheet(null)}
          onDone={(value) => {
            if (value) {
              setSignal(value);
              setDirection('most');
            }
          }}
        />
        <PickerSheet<string>
          visible={sheet === 'collection'}
          title="Collection"
          subtitle={brand ?? undefined}
          options={[
            { value: ALL, label: 'All collections', muted: true },
            ...collections.map((c) => ({ value: c.collection, label: c.collection })),
          ]}
          selected={collection ?? ALL}
          onClose={() => setSheet(null)}
          onDone={(value) => {
            const next = !value || value === ALL ? null : value;
            if (next !== collection) {
              setCollection(next);
              setModel(null);
              setReference(null);
            }
          }}
        />
        <PickerSheet<string>
          visible={sheet === 'model'}
          title="Model"
          subtitle={brandCollection}
          options={[
            { value: ALL, label: 'All models', muted: true },
            ...models.map((m) => ({ value: m, label: m })),
          ]}
          selected={model ?? ALL}
          onClose={() => setSheet(null)}
          onDone={(value) => {
            const next = !value || value === ALL ? null : value;
            if (next !== model) {
              setModel(next);
              setReference(null);
            }
          }}
        />
        <PickerSheet<string>
          visible={sheet === 'reference'}
          title="Reference"
          subtitle={brandCollection}
          searchPlaceholder="Search reference"
          options={[
            { value: ALL, label: 'All references', muted: true },
            ...references.map((r) => ({ value: r, label: r })),
          ]}
          selected={reference ?? ALL}
          onClose={() => setSheet(null)}
          onDone={(value) => setReference(!value || value === ALL ? null : value)}
        />
      </View>
    </SubscriptionOverlay>
  );
}

/** "Day-Date 40" inside collection "Day-Date" → "40". */
function shortModel(model: string, collection: string | null): string {
  if (collection && model.toLowerCase().startsWith(collection.toLowerCase())) {
    const rest = model.slice(collection.length).trim();
    if (rest) return rest;
  }
  return model;
}

/** Sort direction for the retail signals, chosen on the result page (M2.1). */
function DirectionToggle({
  signal,
  direction,
  onChange,
  fonts,
}: {
  signal: Signal;
  direction: Direction;
  onChange: (d: Direction) => void;
  fonts: { medium: string; semiBold: string };
}) {
  const word = signal === 'above_retail' ? 'above' : 'below';
  const options: Array<{ value: Direction; label: string }> = [
    { value: 'most', label: `Most ${word}` },
    { value: 'least', label: `Least ${word}` },
  ];
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === direction;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  fontFamily: active ? fonts.semiBold : fonts.medium,
                  color: active ? UI.text : UI.grey,
                },
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fadeBox: { flex: 1 },
  container: { flex: 1, backgroundColor: UI.white },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: wp(8),
    paddingHorizontal: H_PADDING,
    paddingTop: hp(12),
    paddingBottom: hp(10),
  },
  list: { paddingHorizontal: H_PADDING, paddingTop: hp(4), paddingBottom: hp(120), gap: GAP },
  column: { gap: GAP },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PADDING,
    paddingTop: hp(4),
  },
  empty: { textAlign: 'center', color: UI.grey, fontSize: fp(14), marginTop: hp(40) },
  segment: {
    flexDirection: 'row',
    backgroundColor: UI.fill,
    borderRadius: sp(17),
    padding: sp(3),
  },
  segmentItem: {
    height: sp(28),
    paddingHorizontal: wp(10),
    borderRadius: sp(14),
    justifyContent: 'center',
  },
  segmentItemActive: { backgroundColor: UI.white },
  segmentText: { fontSize: fp(12) },
});
