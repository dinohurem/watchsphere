# November 2026 specs — implementation plan

Sources (repo root): `WatchSphere_Uploading_Editing_Watches.pdf` (**BULK**),
`WatchSphere_Generator_Pipeline_Matching.pdf` (**GEN**), `WatchSphere_App_Redesign_Spec_v3.pdf`
(**UI**, text extract: see each agent brief), screenshot `WhatsApp Image 2026-11-08 at 03.34.08.jpeg`
(5th tab "Checks", shield icon, between Trade and Activity — placeholder only for now; its feature
will be specified later).

Branch: `feat/nov-2026-catalog-pipeline-redesign`. Nobody commits; the lead commits at the end.

## Already done (lead)

- `apps/backend/app/core/market_constants.py` — `LIST_PRICE_COUNTRIES` (13, fixed order, currency,
  tax label), `normalize_list_price_country`, `APP_CURRENCIES` (9), `SUPPORTED_CURRENCIES`
  (+USDT), `PERIOD_DAYS` (1W/1M/3M/1Y/ALL).
- `Watch.list_prices: Dict[str, float]` (country code → price in that country's currency),
  `Watch.discontinued: bool`, indexes on `oem_references`, `aliases`.
- `Order`: `match_method` (exact|image|ai|manual), `ai_reason`, `source_text`, `source_image`,
  `source_group`, `source_run_id`, `first_seen_at`, `last_seen_at`, `excluded_from_median`.
- `User`: `notify_alert_matches`, `preferred_currency`, `username` (unique when string),
  `recently_viewed` (≤5 WS codes, newest first).
- Mobile: `src/utils/marketFormat.ts` (all number/price/percent/count/age formatting rules,
  `convertAmount`, `flagEmoji`, `currencyForRegion`), `src/contexts/CurrencyContext.tsx`
  (`useCurrency()` → `{currency, setCurrency, rates, convert}`; provider mounted in
  `app/_layout.tsx`), `src/components/PickerSheet.tsx` (`PickerSheet`, `BottomSheet`,
  `SheetButton`, `CheckCircle`, `CloseButton`, `PICKER_COLORS`),
  `src/utils/navigation.ts` (`openWatchDetail({id, wsCode, reference, brand, model, highlight, side})`
  → `/market/[id]` with `highlight=orderId1,orderId2`).

## Workstreams and file ownership

| Agent | Scope | Owns (create/modify) |
|---|---|---|
| **A** catalog admin | BULK §1–8 (except §8.2 → B) | new `endpoints/catalog_admin.py`, `services/catalog_admin.py`, `models/change_batch.py`, `services/undo.py`; admin section of `endpoints/market.py` (lines ≥ `/admin/all`); web `AdminWatches.tsx` + new components under `features/admin/components/catalog/` |
| **B** generator | GEN §3, §4, §5, §6, §7, §8.4 (generator side), BULK §8.2 | `services/wtb_wts_service.py`, `services/vision_matching.py`, `services/price_sanity.py`, new `models/remark_rule.py`, new `endpoints/remarks_admin.py`, web `AdminRemarks.tsx`, tests `tests/test_wtb_wts_*.py` |
| **C** pipeline + data | GEN §1, §2, §8 (except generator internals), §9 | new `services/fx.py`, `models/fx_rate.py`, `endpoints/fx.py`, `services/market_stats.py`, `models/market_stats.py`, `services/pipeline.py`, `endpoints/pipeline.py`, `models/pipeline.py`, `services/ai_review.py`, `endpoints/approval.py`, `endpoints/price_check.py`; import path in `endpoints/whatsapp.py` + `endpoints/whatsapp_bridge.py`; `orders.py` FX + remove populate-USD; `ai_chat.py` FX; web `AdminApproval.tsx`, `AdminPriceCheck.tsx`, remove "Populate USD Prices" button |
| **D** redesign backend | UI backend: currency, alerts, activity, push, market browse, detail data, profile, sign-up/approval | `endpoints/watch_alerts.py`, `models/watch_alert.py`, new `services/alert_dispatch.py`, `endpoints/notifications.py`, `models/notification.py`, `endpoints/profile.py`, `endpoints/auth.py`, `core/deps.py`, public part of `endpoints/market.py` (above `/admin/all`), new `endpoints/market_browse.py`, `endpoints/orders.py` order-book response only, `services/notifications.py` |
| **E1** mobile detail | UI §1, §2, §3, §8, P5, M1/M2/M4/M6 | `app/market/[id].tsx` and new components `src/components/detail/*`, `src/components/alerts/*`, new `app/alerts/*` (My alerts) |
| **E2** mobile shell | UI §0.3, §4, §5, §6, §7, §9 (except P5), §10, §11 client, M3/M5, Checks tab | `app/(tabs)/*`, `app/(auth)/*`, new `app/pending.tsx`, profile/settings screens, `src/components/market/*`, `src/components/home/*`, `src/components/activity/*`, `src/components/icons.tsx`, push handling in `app/_layout.tsx` / `NotificationContext` |

Shared files everyone may *append* to (small, targeted edits only — re-read before editing):
`app/db/session.py` (Beanie model list), `app/api/v1/router.py`, `apps/web/src/App.tsx`, web admin
sidebar, `apps/mobile/src/i18n/locales/en.json` (+ `de.json` same keys; use your own top-level
namespace: `catalogAdmin`, `detail`, `alerts`, `shell`, …), `requirements.txt`.

Rules for all agents: do not commit, do not run `git stash/checkout/reset`; follow CLAUDE.md
conventions (Beanie, async, snake_case Python, Tailwind web, StyleSheet + `wp/hp/sp/fp` mobile);
sentence case for UI text; no new colours (UI §0.1). Run `pytest`, web `npx tsc --noEmit`, mobile
`npx tsc --noEmit` (14 pre-existing mobile errors are baseline — do not add new ones). Node lives
at `$HOME/.nvm/versions/node/v22.13.0/bin` (add to PATH); Python venv `apps/backend/venv`.

## Backend contracts

### FX — `app/services/fx.py` (C)
```python
async def load_rates(force: bool = False) -> dict[str, float]   # units per 1 USD, USD=1, USDT=1; cached in-process ~10 min
def convert(amount: float | None, from_cur: str, to_cur: str, rates: dict[str, float]) -> float | None   # pure
async def to_usd(amount: float | None, currency: str | None) -> float | None
async def refresh_rates_from_source() -> dict[str, float]       # daily (ECB via frankfurter.app or ECB XML); falls back to last stored / seeded table
async def recompute_order_usd_prices() -> int                   # after every rate update
```
Public endpoint `GET /api/v1/fx/rates` → `{"base": "USD", "rates": {"EUR": 0.92, ...}, "updated_at": iso}`
(includes all 9 app currencies + USDT). No auth required.

### Market stats — `app/services/market_stats.py` (C)
All medians/percentages are computed here only (GEN §9). Only WTS orders, current FX, dedup
dealer+watch+price, skip `excluded_from_median`, Fresh = Unworn and card date ≤ 3 months old
relative to the listing date, Used = rest, < 3 listings → `None`. Used % change compares same year
with same year and averages (GEN §9.7). Precompute into a `WatchMarketStats` collection after each
import / FX refresh; reads hit that collection.
```python
async def price_trend(ws_code: str, period: str, currency: str) -> dict
# {"period": "1M", "currency": "EUR", "enough_data": bool,
#  "wts_change_pct": float|None,            # value of the trend chip on the detail page
#  "fresh": {"median": float|None, "change_pct": float|None, "count": int,
#            "series": [{"date": "YYYY-MM-DD", "median": float}]},
#  "used":  {same shape}}
async def retail_comparison(ws_code: str, currency: str) -> dict
# {"status": "ok"|"discontinued"|"no_data", "currency": "EUR",
#  "fresh_median": float|None, "avg_vs_retail_pct": float|None,
#  "countries": [{"code": "HK", "name": "Hong Kong", "tax_label": "no VAT",
#                 "list_currency": "HKD", "list_price": float|None,
#                 "list_price_converted": float|None, "vs_retail_pct": float|None,
#                 "status": "ok"|"no_data"|"discontinued"}]}   # all 13 in fixed order
async def card_stats(ws_codes: list[str]) -> dict[str, dict]
# {ws_code: {"change_1m_pct": float|None, "wts_count": int, "wtb_count": int, "retail_pct": float|None}}
# wts/wtb counts are ALL-TIME active listing counts (UI §0.4); change is 1M WTS median change
async def show_signal(signal: str, brand: str | None = None, direction: str | None = None,
                      limit: int = 40, offset: int = 0) -> list[str]   # ordered ws_codes
# signal: top_movers | most_requested | rising | falling | above_retail | below_retail
# direction (retail only): "most" (default) | "least"
async def recompute_all() -> int ; async def recompute_for(ws_codes: list[str]) -> None
```

### Alert dispatch — `app/services/alert_dispatch.py` (D)
```python
async def dispatch_new_listings(order_ids: list[str]) -> int
```
C calls it once after each import run with the ids of **really new** orders only (new
dealer+watch+price; a repost only bumps `last_seen_at`), and when an approval-page decision creates a
listing. D matches alerts, creates Activity entries, sends bundled push (UI §11: one per user per
watch per call; "N new WTS · ref" with cheapest listing; `+N more`).

### Generator structured output (B → C)
`process_generation` additionally stores per run a JSON document (GridFS id on
`WtbWtsRun.rows_json_gridfs_id`) and exposes
`async def load_run_rows(run_id) -> dict[str, list[dict]]` with keys `matched`, `matched_via_image`,
`needs_review`, `not_in_database`, `discarded`, `aftermarket`. Each row = the CSV row dict plus
`_meta`: `{"source_text", "sender_phone", "timestamp", "group_name", "image_file"|None,
"candidates": [{"ws_code","brand","model","reference","score","reason"}], "discard_reason"|None,
"currency_unknown": bool}`. B also exposes `async def run_generator_on_export(chat_txt: str,
media: dict[str, bytes] | None, group_name: str, mode: str, ref_month: int, ref_year: int,
imported_by: str) -> str` (returns run_id; runs synchronously to completion) for the pipeline.

### Public API for mobile (D, unless noted)
- `GET /profile/me` includes `preferred_currency`, `username`, `approved`, `whatsapp_phone`,
  `notifications_enabled`, `email_notifications_enabled`, `notify_alert_matches`.
  `PATCH /profile/me` accepts `preferred_currency` (validated against the 9) and `whatsapp_phone`.
  `PATCH /profile/notification-preferences` accepts the three toggles.
- `GET /auth/me` and login responses include `approved`. Unapproved users **can log in** but every
  endpoint except auth, `/profile/me`, `/support/*`, `/fx/rates` returns 403
  `{"detail": "account_pending_approval"}`. On admin approval the user gets a WhatsApp message
  (reuse whatever WhatsApp sender exists; else log + email fallback).
- `POST /profile/recently-viewed {ws_code}`; `GET /profile/recently-viewed` → list of cards (≤5).
- Card shape (Market, Watchlist, Recently viewed, Search):
  `{"id","ws_code","brand","model","reference","collection","image","thumbnail",
    "change_1m_pct": float|null, "wts_count": int, "wtb_count": int, "retail_pct": float|null}`.
- `GET /market/cards?brand=&signal=&direction=&collection=&model=&reference=&limit=&offset=`
  → `{"items": [card], "total": int}`. With no brand: `signal` (default `top_movers`). With a brand:
  filtered by collection/model/reference, sorted by `top_movers`.
- `GET /market/brand-tabs` → ordered brand names for the tab row (All is client-side).
- `GET /market/facets/collections?brand=` → `[{"collection": str, "model_count": int}]`
- `GET /market/facets/models?brand=&collection=` → `[str]` (Model button shown only if > 1)
- `GET /market/facets/references?brand=&collection=&model=&q=` → `[str]`
- `GET /market/search?q=` → `{"items": [card]}` — resolves aliases / dealer slang ("Pepsi Jubilee",
  "Pikachu") to WS codes using the same alias data as the generator.
- `GET /profile/watchlist` items additionally carry the card fields.
- `GET /market/detail/{ws_code}/trend?period=1M&currency=EUR` → `price_trend` output.
- `GET /market/detail/{ws_code}/retail?currency=EUR` → `retail_comparison` output.
- `GET /orders/book/{reference}` entries additionally carry `ws_code`, `year`, `watch_month`,
  `year_raw`, `condition_raw`, `created_at` (ISO), `usd_price`; response includes
  `wts_count_all_time`, `wtb_count_all_time`.
- Alerts (`/watch-alerts`):
  `GET /watch-alerts` (all mine, newest first, each with `brand`, `model`, `reference` for headers),
  `GET /watch-alerts/{ws_code}`, `POST /watch-alerts`, `PUT /watch-alerts/{id}`, `DELETE /watch-alerts/{id}`.
  Alert shape: `{"id","ws_code","alert_type":"wts"|"wtb","year_mode":"any"|"newer"|"exactly"|"older",
  "year": int|null, "month": int|null, "condition":"any"|"unworn"|"used",
  "locations": [codes; "EU" allowed; empty = worldwide],
  "price_mode":"any"|"max"|"min", "price_amount": float|null, "currency": str,
  "brand","model","reference","created_at"}`. WTS uses any|max ("up to"), WTB uses any|min
  ("Every WTB" / "only with a target price ≥"). Legacy alerts (notify_wts/notify_wtb) are migrated
  lazily on read.
- Activity (`/notifications`, existing endpoints, filter `?type=alert_match`): each item
  `{"id","type":"alert_match","read","created_at","data":{"kind":"wts"|"wtb","ws_code","reference",
  "brand","model","thumbnail","country_code","country_name","year": int|null,"year_plus": bool,
  "condition":"Unworn"|"Used"|null,"price": float|null,"currency": str|null,
  "order_ids": [str],"count": int,"dealer_phone": str|null,"watch_id": str|null}}`.
  `POST /notifications/read-all`, `GET /notifications/unread-count?type=alert_match`.
- Push data payload: `{"type":"alert_match","ws_code","watch_id","order_ids":"id1,id2","kind":"wts"|"wtb"}`;
  title `New WTS · 5811/1G` / `3 new WTS · 126518LN Pikachu`; body line 2 `🇭🇰 Hong Kong · 2023 · Used`,
  line 3 `Price: 1.428.000 HKD` / `Target: 1.350.000 HKD` / `Target: /` (+ ` · +2 more`).
  iOS category `alert_match` with action "View listing(s)".

## Verification (lead, end)
pytest green incl. new tests; web `tsc` clean; mobile `tsc` at baseline; backend boots
(`uvicorn app.main:app`) and new routes appear in `/openapi.json`; code review pass over the diff.
