# WatchSphere Mobile (React Native + Expo)

React Native mobile application for the WatchSphere watch trading platform.

## Why React Native + Expo?

- **Code Sharing**: 60-80% code reuse with the React web app
- **Single Language**: TypeScript across web, mobile, and backend
- **Fast Development**: Expo provides instant setup and OTA updates
- **Perfect Fit**: Ideal for business/trading apps with forms, lists, and real-time data
- **Modern Routing**: Expo Router provides file-based routing (like Next.js)

## Tech Stack

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **Expo Router** - File-based navigation
- **TypeScript** - Type safety
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Axios** - HTTP client
- **Socket.io** - Real-time communication
- **AsyncStorage** - Local storage
- **React Native SVG** - Vector graphics for icons

## Project Structure

```
mobile/
├── app/                      # Expo Router screens (file-based routing)
│   ├── (tabs)/              # Tab navigation group
│   │   ├── index.tsx        # Home tab
│   │   ├── market.tsx       # Market tab
│   │   ├── dashboard.tsx    # Dashboard tab
│   │   ├── chat.tsx         # Chat tab
│   │   └── profile.tsx      # Profile tab
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/          # Reusable UI components
│   ├── features/            # Feature-specific code
│   ├── shared/              # Shared utilities (can be synced with web)
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and business logic
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript types
│   ├── constants/           # App constants
│   └── assets/              # Images, fonts, etc.
├── app.json                 # Expo configuration
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript config
```

## Setup

### Prerequisites
- Node.js (>=18.x)
- npm, yarn, or pnpm
- For iOS: macOS with Xcode (for simulator or building)
- For Android: Android Studio (for emulator or building)

### Quick Start (Recommended)

1. **Install dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```

3. **Run on device or simulator**:
   - Scan QR code with **Expo Go** app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web preview

### Alternative: Direct Platform Launch

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## Development

### File-Based Routing (Expo Router)

Expo Router uses the file system for navigation:
- `app/(tabs)/index.tsx` → Home tab
- `app/(tabs)/market.tsx` → Market tab
- `app/details/[id].tsx` → Dynamic route

### Key Features Implemented

#### 1. Home Screen (`app/(tabs)/index.tsx`)
- ✅ Time-based greeting
- ✅ Quick access buttons:
  - Activity Center
  - Smart Search
  - Buy/Sell
  - AI Assistant
  - My Inventory
  - My Orders
  - Checks
  - All Tools
- ✅ Customizable layout section
- ✅ Market news feed

#### 2. Bottom Tab Navigation
- ✅ 5 tabs: Home, Market, Dashboard, Chats, Profile
- ✅ Custom icons
- ✅ Active/inactive states

### Shared Code with Web

The following can be shared between web and mobile:
- `src/types/` - TypeScript types
- `src/services/api.ts` - API client
- `src/constants/api.ts` - API endpoints
- Business logic and utilities

To share code, consider creating a shared package or using a monorepo tool like Turborepo.

## State Management

### Server State (TanStack Query)
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['watches'],
  queryFn: () => api.get('/market'),
});
```

### Client State (Zustand)
```typescript
import { create } from 'zustand';

interface AppState {
  user: User | null;
  setUser: (user: User) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

## API Integration

Configure the API in `.env`:
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787/api/v1
EXPO_PUBLIC_WS_BASE_URL=ws://localhost:8787/ws
```

**Note**: Use `EXPO_PUBLIC_` prefix for environment variables that should be accessible in the app.

## Styling

React Native uses StyleSheet API:
```tsx
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});
```

### Design System
- Primary Color: `#1A1A1A`
- Accent Color: `#D4AF37` (Gold)
- Background: `#F5F5F5`

## Icons

Using custom SVG icons in `src/components/icons.tsx`. Icons are:
- Scalable
- Customizable (size, color, fill)
- Lightweight

## Real-time Features

WebSocket support via Socket.io:
```typescript
import io from 'socket.io-client';

const socket = io('ws://localhost:8787');
socket.on('price_update', (data) => {
  // Handle real-time price updates
});
```

## Testing on Device

### With Expo Go (Fastest)
1. Install **Expo Go** from App Store/Play Store
2. Run `npm start`
3. Scan QR code with:
   - **iOS**: Camera app
   - **Android**: Expo Go app

### Development Build (Custom Native Code)
```bash
# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Building for Production

### EAS Build (Recommended)
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build
```bash
# iOS (requires macOS)
npm run ios --configuration Release

# Android
npm run android --variant=release
```

## Over-the-Air (OTA) Updates

Expo allows you to push updates without app store review:
```bash
eas update --branch production
```

Users get updates automatically on next app launch!

## TypeScript

The app is fully typed:
- Path aliases configured (`@/`, `@components/`, etc.)
- Strict mode enabled
- Type checking: `npm run type-check`

## Debugging

- **React DevTools**: Installed by default with Expo
- **Console logs**: Visible in terminal
- **Network**: Use React Native Debugger or Flipper
- **Errors**: Red box shows errors in development

## Performance

- Use `React.memo` for expensive components
- Use `useMemo` and `useCallback` for optimization
- Use `FlatList` for long lists (virtualized)
- Optimize images with `expo-optimize`

## Code Sharing Strategy

### Option 1: Shared Folder (Simple)
```
shared/
├── types/
├── api/
└── utils/

# Symlink or copy to web/src/shared and mobile/src/shared
```

### Option 2: Monorepo (Advanced)
Use Turborepo or Nx:
```
packages/
├── shared/       # Shared code
├── web/          # Web app
└── mobile/       # Mobile app
```

## Next Steps

1. **Implement Authentication**:
   - Login/Register screens
   - Secure token storage (expo-secure-store)
   - Auth context

2. **Market Screen**:
   - Watch listings
   - Search and filters
   - Real-time price updates

3. **Chat Feature**:
   - WebSocket integration
   - Message list
   - Direct and group chats

4. **AI Assistant**:
   - Chat interface
   - Voice input (optional)
   - Suggestions

## Common Commands

```bash
npm start              # Start development server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run web            # Run on web
npm run lint           # Lint code
npm run type-check     # Check TypeScript types
```

## Resources

- [Expo Docs](https://docs.expo.dev/)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Native Docs](https://reactnative.dev/)
- [TanStack Query Docs](https://tanstack.com/query/latest)

## Advantages Over Flutter

✅ Code sharing with React web app
✅ Same language (TypeScript) everywhere
✅ Faster development with Expo tooling
✅ OTA updates without app store
✅ Larger ecosystem (npm)
✅ Easier to find React developers
✅ Web preview built-in

---

Built with ❤️ for watch enthusiasts and dealers worldwide.
