/**
 * Mock data shown during the product tour (guide) so new users
 * see a populated UI instead of empty states.
 *
 * Interfaces are kept in sync with the types declared in each screen file.
 * Dates are pre-formatted strings so we don't depend on formatTimeAgo.
 */

// ── Home screen: Watchlist ──────────────────────────────────────

export const GUIDE_MOCK_WATCHLIST = [
  {
    id: 'guide-1',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    price: 12450,
    priceChange: 2.3,
    image: undefined,
    isFromUserWatchlist: false,
  },
  {
    id: 'guide-2',
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '5711/1A-010',
    price: 128500,
    priceChange: -1.4,
    image: undefined,
    isFromUserWatchlist: false,
  },
  {
    id: 'guide-3',
    brand: 'Omega',
    model: 'Speedmaster Professional',
    reference: '310.30.42.50.01.002',
    price: 6250,
    priceChange: 0.8,
    image: undefined,
    isFromUserWatchlist: false,
  },
  {
    id: 'guide-4',
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    reference: '15500ST.OO.1220ST.01',
    price: 42800,
    priceChange: 3.1,
    image: undefined,
    isFromUserWatchlist: false,
  },
];

// ── Home screen: Activity ───────────────────────────────────────

export const GUIDE_MOCK_ACTIVITY = [
  {
    id: 'guide-act-1',
    type: 'new_offer' as const,
    reference: '126610LN',
    price: 12100,
    time: '5 min ago',
    orderId: null,
    orderType: 'buy' as const,
  },
  {
    id: 'guide-act-2',
    type: 'new_listing' as const,
    reference: '5711/1A-010',
    price: 129000,
    time: '23 min ago',
    orderId: null,
    orderType: 'sell' as const,
  },
  {
    id: 'guide-act-3',
    type: 'price_undercut' as const,
    reference: '126610LN',
    price: 11950,
    time: '1 hr ago',
    orderId: null,
    orderType: 'sell' as const,
  },
];

// ── Home screen: News ───────────────────────────────────────────

export const GUIDE_MOCK_NEWS = [
  {
    id: 'guide-news-1',
    title: 'Rolex Increases Retail Prices Across Key Models for 2026',
    source: 'Hodinkee',
    time: '2 hrs ago',
    imageUrl: undefined,
  },
  {
    id: 'guide-news-2',
    title: 'Patek Philippe Nautilus Demand Continues to Surge in Secondary Market',
    source: 'WatchPro',
    time: '5 hrs ago',
    imageUrl: undefined,
  },
  {
    id: 'guide-news-3',
    title: 'Omega Announces New MoonSwatch Collaboration Colors',
    source: 'Revolution Watch',
    time: '1 day ago',
    imageUrl: undefined,
  },
];

// ── Market screen: Watch list ───────────────────────────────────

function sparkline(base: number, variance: number, points = 7): number[] {
  const data: number[] = [];
  let price = base;
  for (let i = 0; i < points; i++) {
    price += (Math.random() - 0.48) * variance;
    data.push(Math.round(price));
  }
  return data;
}

export const GUIDE_MOCK_MARKET_WATCHES = [
  {
    id: '126610LN',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    price: 12450,
    priceChange: 2.3,
    priceHistory: sparkline(12000, 300),
    trending: true,
    orderCount: 24,
  },
  {
    id: '5711/1A-010',
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '5711/1A-010',
    price: 128500,
    priceChange: -1.4,
    priceHistory: sparkline(130000, 2000),
    trending: false,
    orderCount: 18,
  },
  {
    id: '310.30.42.50.01.002',
    brand: 'Omega',
    model: 'Speedmaster Professional',
    reference: '310.30.42.50.01.002',
    price: 6250,
    priceChange: 0.8,
    priceHistory: sparkline(6100, 150),
    trending: false,
    orderCount: 31,
  },
  {
    id: '15500ST.OO.1220ST.01',
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    reference: '15500ST.OO.1220ST.01',
    price: 42800,
    priceChange: 3.1,
    priceHistory: sparkline(41000, 1000),
    trending: false,
    orderCount: 12,
  },
  {
    id: '116500LN',
    brand: 'Rolex',
    model: 'Daytona',
    reference: '116500LN',
    price: 32100,
    priceChange: 1.5,
    priceHistory: sparkline(31000, 800),
    trending: false,
    orderCount: 22,
  },
  {
    id: '326235',
    brand: 'Rolex',
    model: 'Sky-Dweller',
    reference: '326235',
    price: 52300,
    priceChange: -0.6,
    priceHistory: sparkline(52500, 600),
    trending: false,
    orderCount: 8,
  },
  {
    id: '5167A-001',
    brand: 'Patek Philippe',
    model: 'Aquanaut',
    reference: '5167A-001',
    price: 54800,
    priceChange: 2.0,
    priceHistory: sparkline(53000, 1200),
    trending: false,
    orderCount: 15,
  },
  {
    id: '210.30.42.20.03.001',
    brand: 'Omega',
    model: 'Seamaster Diver 300M',
    reference: '210.30.42.20.03.001',
    price: 4850,
    priceChange: -0.3,
    priceHistory: sparkline(4900, 100),
    trending: false,
    orderCount: 27,
  },
];

// ── Market screen: Trending watches ─────────────────────────────

export const GUIDE_MOCK_TRENDING_WATCHES = [
  {
    id: '126610LN',
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    price: 12450,
    priceChange: 2.3,
    priceHistory: sparkline(12000, 300),
    trending: true,
    orderCount: 24,
  },
  {
    id: '116500LN',
    brand: 'Rolex',
    model: 'Daytona',
    reference: '116500LN',
    price: 32100,
    priceChange: 1.5,
    priceHistory: sparkline(31000, 800),
    trending: true,
    orderCount: 22,
  },
  {
    id: '5711/1A-010',
    brand: 'Patek Philippe',
    model: 'Nautilus',
    reference: '5711/1A-010',
    price: 128500,
    priceChange: -1.4,
    priceHistory: sparkline(130000, 2000),
    trending: true,
    orderCount: 18,
  },
  {
    id: '15500ST.OO.1220ST.01',
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    reference: '15500ST.OO.1220ST.01',
    price: 42800,
    priceChange: 3.1,
    priceHistory: sparkline(41000, 1000),
    trending: true,
    orderCount: 12,
  },
];

// ── Watch Details screen ────────────────────────────────────────

export const GUIDE_MOCK_WATCH_DETAILS = {
  id: '126610LN',
  brand: 'Rolex',
  model: 'Submariner Date',
  reference: '126610LN',
  image: undefined,
  currency: 'EUR',
  marketPriceMin: 11800,
  marketPriceMax: 13200,
  priceChange: 2.3,
  bestBid: 12100,
  bestAsk: 12500,
  spread: 400,
  priceHistory: [11600, 11750, 11900, 12050, 11980, 12150, 12300, 12180, 12350, 12400, 12450],
};

// ── Watch Details screen: Order Book ────────────────────────────

export const GUIDE_MOCK_BUY_ORDERS = [
  {
    id: 'guide-buy-1',
    country_code: 'de',
    country_name: 'Germany',
    date: '02/10',
    condition: 'Used' as const,
    price: 12100,
    has_box: true,
    has_papers: true,
  },
  {
    id: 'guide-buy-2',
    country_code: 'us',
    country_name: 'United States',
    date: '02/09',
    condition: 'Unworn' as const,
    price: 12000,
    has_box: true,
    has_papers: true,
  },
  {
    id: 'guide-buy-3',
    country_code: 'ch',
    country_name: 'Switzerland',
    date: '02/08',
    condition: 'Used' as const,
    price: 11900,
    has_box: false,
    has_papers: true,
  },
  {
    id: 'guide-buy-4',
    country_code: 'at',
    country_name: 'Austria',
    date: '02/07',
    condition: 'Unworn' as const,
    price: 11800,
    has_box: true,
    has_papers: false,
  },
];

export const GUIDE_MOCK_SELL_ORDERS = [
  {
    id: 'guide-sell-1',
    country_code: 'de',
    country_name: 'Germany',
    date: '02/10',
    condition: 'Unworn' as const,
    price: 12500,
    has_box: true,
    has_papers: true,
  },
  {
    id: 'guide-sell-2',
    country_code: 'us',
    country_name: 'United States',
    date: '02/09',
    condition: 'Used' as const,
    price: 12800,
    has_box: true,
    has_papers: true,
  },
  {
    id: 'guide-sell-3',
    country_code: 'jp',
    country_name: 'Japan',
    date: '02/08',
    condition: 'Unworn' as const,
    price: 13000,
    has_box: true,
    has_papers: true,
  },
  {
    id: 'guide-sell-4',
    country_code: 'gb',
    country_name: 'United Kingdom',
    date: '02/07',
    condition: 'Used' as const,
    price: 13200,
    has_box: false,
    has_papers: true,
  },
];
