# CLAUDE.md — WatchSphere

## Project Overview

WatchSphere is a premium watch trading platform (marketplace, real-time chat, inventory management, AI assistant). It is a **Turborepo monorepo** with four apps and one shared package.

## Architecture

```
watchsphere/
├── apps/
│   ├── backend/       # FastAPI (Python) — REST API, WebSocket, Socket.IO
│   ├── web/           # React 18 + Vite + TypeScript — Web application
│   ├── mobile/        # Expo 52 + React Native 0.76 — iOS/Android app
│   └── whatsapp-bridge/  # Node + Baileys — live capture from export-locked dealer groups
├── packages/
│   └── shared/        # @watchsphere/shared — Zustand stores, types, utils
├── turbo.json         # Turborepo task orchestration
└── package.json       # Root — npm workspaces
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI 0.109 (Python, async) |
| Database | MongoDB via Motor (async) + Beanie ODM |
| Auth | JWT (HS256) + bcrypt, Google/Apple OAuth |
| Real-time | Native WebSocket (web) + Socket.IO (mobile), unified broadcast service |
| Web framework | React 18.2 + TypeScript 5.3 + Vite 5 |
| Mobile framework | React Native 0.76 + Expo 52 + Expo Router (file-based routing) |
| Styling (web) | Tailwind CSS 3.4 + CVA for component variants |
| Styling (mobile) | React Native StyleSheet + responsive scaling utils (wp/hp/sp/fp) |
| Client state | Zustand 4.5 (shared package, persisted) |
| Server state | TanStack Query 5.17 |
| HTTP client | Axios with auth interceptors and token refresh |
| i18n | i18next (English + German) |
| Payments | Monri payment gateway |
| Push notifications | Expo Push + Firebase Cloud Messaging |
| File storage | Firebase Storage (WebP optimization + thumbnails) |
| Email | Postmark |
| AI | OpenAI API |

## Common Commands

```bash
# Root — run all apps
npm run dev          # Start all dev servers via Turbo
npm run build        # Build all apps
npm run lint         # Lint all apps
npm run type-check   # TypeScript check all apps
npm run format       # Prettier format

# Backend (from apps/backend/)
source venv/bin/activate
uvicorn app.main:app --reload --port 8787   # Dev server on :8787
python scripts/seed_admin.py    # Seed admin user

# Web (from apps/web/)
npm run dev          # Vite dev server on :5177
npm run build        # Production build to dist/

# Mobile (from apps/mobile/)
npm start            # Expo dev server
npm run ios          # iOS simulator
npm run android      # Android emulator
```

## Backend Structure

- **Entry point**: `apps/backend/app/main.py` — creates FastAPI app + Socket.IO mount
- **API prefix**: `/api/v1`
- **Endpoints**: `app/api/v1/endpoints/` — 25+ modules (auth, market, inventory, orders, chat, chat_groups, profile, admin, billing, notifications, news, ai_chat, ai_insights, upload, support, reviews, filters, listing_fields, whatsapp, watchlist_admin, etc.)
- **Models**: `app/models/` — 23+ Beanie document models (User, Watch, Order, Message, Conversation, Billing, Subscription, Notification, ActivityLog, Review, etc.)
- **Services**: `app/services/` — business logic (broadcast, websocket, socketio_manager, payment, notifications, storage, email, ai_chat, watchlist)
- **Config**: `app/core/config.py` — Pydantic Settings
- **Security**: `app/core/security.py` — JWT creation/verification, password hashing
- **Dependencies**: `app/core/deps.py` — `get_current_user`, `get_current_active_user`, `get_current_admin_user`
- **Database**: `app/db/session.py` — Motor client, Beanie init with all models

### Backend Conventions
- Async-first (all endpoints use `async def`)
- Beanie ODM for MongoDB documents — no raw queries
- JWT auth with Bearer scheme, 24h access / 30d refresh tokens
- User roles: `dealer`, `collector`, `admin`
- Activity logging for all significant operations
- Dual real-time protocol: WebSocket at `/ws` (web) and Socket.IO at `/socket.io/` (mobile)
- Image upload: auto-optimize to WebP, generate 400x400 thumbnails

## Web Structure

- **Entry**: `apps/web/src/main.tsx` → `App.tsx` (React Router v6)
- **Features**: `src/features/` — feature-based modules (home, market, inventory, chat, profile, auth, admin, payment, notifications, news, search, watchlist, social, legal, dashboard)
- **Components**: `src/components/` — layout (UserLayout, AdminLayout, Header, Sidebar), ui (button with CVA variants), landing, subscription
- **Services**: `src/services/api.ts` (Axios + interceptors), `chatWebSocket.ts` (WebSocket client)
- **Hooks**: `src/hooks/useConfig.ts` (dynamic field/filter config), `useSubscription.ts`
- **i18n**: `src/i18n/locales/` — en.json, de.json
- **Routing**: React Router v6 with ProtectedRoute and AdminRoute guards

### Web Conventions
- Feature-based folder structure: `src/features/<name>/pages/`, `src/features/<name>/components/`
- Pages named `*Page.tsx`, components `PascalCase.tsx`
- Tailwind utility classes for styling; custom colors via tailwind.config.js (`primary: #1A1A1A`, `accent: #D4AF37`)
- CVA (class-variance-authority) for button variants
- `cn()` from `src/lib/utils.ts` for classname merging
- Data fetching: most pages use `useState` + `useEffect` + `api.get()`, some use React Query
- Path alias: `@/` → `src/`
- Environment variables prefixed with `VITE_`

## Mobile Structure

- **Entry**: `apps/mobile/app/_layout.tsx` — root layout with providers
- **Routing**: Expo Router file-based — `app/(auth)/`, `app/(tabs)/`, `app/chat/`, `app/market/`, `app/settings/`, etc.
- **Tabs**: Home, Market, Chat, Dashboard (inventory), Profile (+ hidden: notifications)
- **Components**: `src/components/` — 38+ reusable components
- **Services**: `src/services/api.ts` (Axios), `src/services/chatService.ts` (Socket.IO singleton)
- **Contexts**: ThemeContext, ChatContext, FilterContext, NotificationContext, SubscriptionContext, AIButtonContext, ConfigContext, GuideContext
- **Theme**: `src/theme/` — design tokens for colors, typography, spacing (light/dark modes)
- **i18n**: `src/i18n/` — AsyncStorage-based language detector

### Mobile Conventions
- Expo Router file-based routing — routes in `app/` directory, route groups in parentheses `(tabs)`, dynamic routes with `[param]`
- All dimensions use responsive utilities: `wp()`, `hp()`, `sp()`, `fp()` from `src/utils/responsive.ts` (base: 393x852 iPhone 14 Pro)
- StyleSheet.create for all styles
- Font: HankenGrotesk (custom via expo-font)
- Zustand stores persisted via AsyncStorage
- ChatService is a singleton with event emitter pattern
- Environment variables prefixed with `EXPO_PUBLIC_`

## WhatsApp Bridge (apps/whatsapp-bridge)

Node service (TypeScript + Baileys) paired to a **dedicated** WhatsApp number. It
captures messages from allow-listed dealer groups that cannot be exported (Advanced
Chat Privacy) and streams them to `/api/v1/whatsapp-bridge/messages`.

- **Entry**: `src/index.ts` — live mode, `--pair <number>`, `--replay <fixture>`
- **Modules**: `format.ts` (raw → captured, no Baileys import so it stays testable),
  `outbox.ts` (disk-backed queue, captures survive outages), `flusher.ts`, `api.ts`,
  `whatsapp.ts` (the only Baileys-aware module)
- **Backend side**: `app/api/v1/endpoints/whatsapp_bridge.py`, `BridgeMessage` /
  `BridgeStatus` models, `services/whatsapp_bridge_export.py`
- Captures are stored raw and rendered back into WhatsApp export format on demand,
  so the existing WTS/WTB generator runs unchanged — **nothing reaches the order book
  without an admin generating and reviewing the CSVs**
- Auth: shared secret `WHATSAPP_BRIDGE_TOKEN` (backend) / `BRIDGE_API_TOKEN` (bridge);
  unset means the endpoints return 503, never open access
- Group allowlist is fail-closed — empty `BRIDGE_GROUPS` captures nothing
- Runs on Baileys, an unofficial library: ToS risk, needs an always-on host (not Vercel)

## Shared Package (@watchsphere/shared)

Located at `packages/shared/`:
- **Stores**: `stores/useAuthStore.ts`, `useAppStore.ts`, `useChatStore.ts`, `useMarketStore.ts` — Zustand with persist middleware
- **Types**: `types/index.ts` — ApiResponse, PaginatedResponse, ApiError
- **Utils**: `utils/formatters.ts` (formatPrice, formatDate, formatRelativeTime), `utils/validators.ts` (isValidEmail, isStrongPassword, isValidSerialNumber)
- **Lib**: `lib/storage.ts` — platform-agnostic storage adapter (delegates to localStorage or AsyncStorage)

## Code Style & Formatting

- **Prettier**: semi, singleQuote, trailingComma: es5, printWidth: 100, tabWidth: 2
- **TypeScript**: strict mode in all packages
- **Python**: standard PEP 8 (FastAPI conventions)
- **Imports**: group by React/external/local; use path aliases (`@/`)
- **Components**: functional only, hooks-based, no class components
- **Naming**: PascalCase for components/types, camelCase for functions/variables, snake_case in Python backend

## Environment Variables

| App | Prefix | Key vars |
|-----|--------|----------|
| Backend | none | `MONGODB_URL`, `SECRET_KEY`, `OPENAI_API_KEY`, `MONRI_*`, `POSTMARK_API_KEY`, `ALLOWED_ORIGINS` |
| Web | `VITE_` | `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` |
| Mobile | `EXPO_PUBLIC_` | `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKETIO_URL`, `EXPO_PUBLIC_WEB_URL` |

## Deployment

- **Backend**: Vercel Serverless (vercel.json in apps/backend/)
- **Web**: Vercel Static (vercel.json in apps/web/)
- **Mobile**: EAS Build → App Store / Google Play (eas.json)
- **Database**: MongoDB Atlas
- **Storage**: Firebase Storage

## Key Architectural Decisions

1. **Dual real-time protocol** — WebSocket for web, Socket.IO for mobile, unified via broadcast service in backend
2. **Zustand in shared package** — single source of truth for auth/chat/market state across web and mobile
3. **Beanie ODM** — async MongoDB with document models, no raw queries
4. **Feature-based organization** — both web and mobile organize code by feature domain
5. **Dynamic configuration** — listing fields and market filters fetched from backend, not hardcoded
6. **Token refresh with queue** — both web and mobile Axios interceptors queue requests during token refresh
7. **Platform-agnostic storage adapter** — shared stores work on both web (localStorage) and mobile (AsyncStorage)
