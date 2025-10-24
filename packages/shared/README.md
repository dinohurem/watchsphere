# @watchsphere/shared

Shared code between WatchSphere web and mobile applications.

## What's Shared?

This package contains code that can be used by both the React web app and React Native mobile app:

- **Zustand Stores** - State management
- **Types** - TypeScript interfaces and types
- **Utilities** - Helper functions
- **Validators** - Input validation logic
- **Formatters** - Date, price, text formatting

## Why Share Code?

✅ **Single Source of Truth** - Write once, use everywhere
✅ **Type Safety** - Shared TypeScript types ensure consistency
✅ **Faster Development** - Don't duplicate business logic
✅ **Easier Maintenance** - Update in one place
✅ **Consistency** - Same behavior across platforms

## Structure

```
shared/
├── stores/              # Zustand state stores
│   ├── useAuthStore.ts
│   ├── useAppStore.ts
│   ├── useMarketStore.ts
│   ├── useChatStore.ts
│   └── index.ts
├── types/               # TypeScript types
│   └── index.ts
├── utils/               # Utility functions
│   ├── formatters.ts
│   └── validators.ts
├── services/            # API services (optional)
└── package.json
```

## Usage

### In Web App

```typescript
// web/src/pages/HomePage.tsx
import { useAuthStore, useMarketStore } from '@watchsphere/shared/stores';

function HomePage() {
  const user = useAuthStore((state) => state.user);
  const watches = useMarketStore((state) => state.watches);

  return <div>Welcome {user?.name}</div>;
}
```

### In Mobile App

```typescript
// mobile/src/features/home/HomeScreen.tsx
import { useAuthStore, useMarketStore } from '@watchsphere/shared/stores';

function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const watches = useMarketStore((state) => state.watches);

  return <Text>Welcome {user?.name}</Text>;
}
```

## Zustand Stores

### useAuthStore
Manages authentication state:
- User data
- Authentication token
- Login/logout actions

### useAppStore
Manages app-level UI state:
- Theme (light/dark/system)
- Sidebar open/closed
- Notification count

### useMarketStore
Manages market data:
- Watch listings
- Filters
- Sort options
- View mode (grid/list)

### useChatStore
Manages chat state:
- Conversations
- Messages
- Unread counts
- Active conversation

## Utilities

### Formatters (`utils/formatters.ts`)
- `formatPrice()` - Format currency
- `formatDate()` - Format dates
- `formatRelativeTime()` - "2 hours ago"
- `truncate()` - Truncate long text

### Validators (`utils/validators.ts`)
- `isValidEmail()` - Email validation
- `isStrongPassword()` - Password strength
- `isValidSerialNumber()` - Serial validation

## How to Link

### Option 1: npm/yarn link (Development)

```bash
# In shared folder
cd shared
npm link

# In web folder
cd ../web
npm link @watchsphere/shared

# In mobile folder
cd ../mobile
npm link @watchsphere/shared
```

### Option 2: File Path (Simple)

In `web/package.json` and `mobile/package.json`:
```json
{
  "dependencies": {
    "@watchsphere/shared": "file:../shared"
  }
}
```

### Option 3: Monorepo (Advanced)

Use Turborepo or Nx:
```
packages/
├── shared/
├── web/
└── mobile/
```

## Adding New Stores

1. Create store in `stores/`
2. Export from `stores/index.ts`
3. Export types from `types/index.ts`
4. Document usage in README

Example:
```typescript
// stores/useInventoryStore.ts
import { create } from 'zustand';

interface InventoryState {
  items: Item[];
  addItem: (item: Item) => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
}));
```

## Persistence

For web, use `localStorage`:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({ /* state */ }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

For mobile, use `AsyncStorage`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({ /* state */ }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## Best Practices

1. **Keep stores focused** - One store per domain
2. **Use TypeScript** - Always type your state and actions
3. **Avoid over-normalization** - Zustand is not Redux
4. **Use selectors** - `const user = useAuthStore((s) => s.user)`
5. **Actions are simple** - No complex logic in stores
6. **Test utilities** - Write tests for validators and formatters

## Benefits vs Alternatives

### vs Redux Toolkit
- ✅ Much lighter (1KB vs 11KB)
- ✅ Less boilerplate
- ✅ Easier to learn
- ✅ No providers needed

### vs Context API
- ✅ Better performance
- ✅ DevTools support
- ✅ Middleware support
- ✅ No re-render issues

### vs Jotai/Recoil
- ✅ Simpler mental model
- ✅ Better for React Native
- ✅ More straightforward

## DevTools

Install Redux DevTools browser extension, then:

```typescript
import { devtools } from 'zustand/middleware';

export const useAuthStore = create(
  devtools(
    (set) => ({ /* state */ }),
    { name: 'AuthStore' }
  )
);
```

---

**Built for code sharing between web and mobile** ❤️
