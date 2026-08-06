# WatchSphere Web

React web application for the WatchSphere watch trading platform.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Socket.io** - Real-time communication

## Project Structure

```
web/
├── src/
│   ├── components/
│   │   └── layout/          # Layout components (Sidebar, Header, etc.)
│   ├── features/
│   │   ├── home/            # Home feature
│   │   ├── market/          # Market feature
│   │   ├── dashboard/       # Dashboard feature
│   │   ├── chat/            # Chat feature
│   │   ├── profile/         # Profile feature
│   │   └── auth/            # Authentication
│   ├── shared/              # Shared utilities and components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API services
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript types
│   ├── assets/              # Static assets
│   ├── config/              # Configuration
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Public assets
├── index.html               # HTML template
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
└── tailwind.config.js       # Tailwind config
```

## Feature Structure

Each feature follows this structure:
```
feature_name/
├── components/              # Feature-specific components
├── hooks/                   # Feature-specific hooks
├── pages/                   # Feature pages/screens
├── services/                # Feature API services
├── types/                   # Feature types
└── utils/                   # Feature utilities
```

## Setup

### Prerequisites
- Node.js (>=18.x)
- npm, yarn, or pnpm

### Installation

1. **Install dependencies**:
   ```bash
   cd web
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API URLs
   ```

3. **Run development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open browser**:
   - Navigate to http://localhost:5177

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Key Features to Implement

### 1. Home Page
- Time-based personalized greeting
- Quick access button grid:
  - Activity Center
  - Smart Search
  - Buy
  - Sell
  - Ask AI Assistant
  - My Inventory
  - My Orders
  - Checks
  - All Tools
- Customizable layout (drag & drop)
- Latest market news feed

### 2. Market Page
- Live market listings
- Smart search with filters
- Order book view
- Auction section
- Real-time price updates

### 3. Dashboard
- Inventory management
- Order tracking
- Analytics & insights
- Quick actions

### 4. Chat
- Direct dealer messaging
- Group chats
- AI assistant chat
- Unread message badges
- Real-time updates via WebSocket

### 5. Profile
- Account settings
- Verification status
- Billing & subscriptions
- User preferences

## State Management

### Server State (TanStack Query)
```typescript
import { useQuery } from '@tanstack/react-query'

const { data, isLoading } = useQuery({
  queryKey: ['watches'],
  queryFn: () => api.get('/market'),
})
```

### Client State (Zustand)
```typescript
import { create } from 'zustand'

interface AppState {
  user: User | null
  setUser: (user: User) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
```

## API Integration

The web app connects to the FastAPI backend:
- Base URL: `http://localhost:8787/api/v1`
- WebSocket: `ws://localhost:8787/ws`

Configure these in `.env`:
```
VITE_API_BASE_URL=http://localhost:8787/api/v1
VITE_WS_BASE_URL=ws://localhost:8787/ws
```

## Styling with Tailwind

Use Tailwind utility classes:
```tsx
<button className="btn btn-primary">
  Click me
</button>
```

Custom components use the `@layer components` directive in `index.css`.

## Real-time Features

WebSocket integration for:
- Live market price updates
- Real-time chat messages
- Notifications
- Activity updates

## Type Safety

TypeScript is used throughout:
- Define types in `src/types/`
- Use interfaces for API responses
- Leverage type inference

Example:
```typescript
interface Watch {
  id: string
  brand: string
  model: string
  price: number
}
```

## Code Sharing with Mobile

If using React Native for mobile, you can share:
- Type definitions
- API service logic
- Business logic utilities
- Constants and configuration

## Building for Production

```bash
npm run build
```

Output will be in `dist/` directory, ready to deploy to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## Environment Variables

- `VITE_API_BASE_URL` - Backend API URL
- `VITE_WS_BASE_URL` - WebSocket URL

Note: Vite requires `VITE_` prefix for environment variables.

## Best Practices

1. **Component Organization**: Keep components small and focused
2. **Custom Hooks**: Extract reusable logic into hooks
3. **Error Handling**: Use error boundaries and try-catch
4. **Performance**: Use React.memo, useMemo, useCallback where needed
5. **Accessibility**: Use semantic HTML and ARIA attributes
6. **Responsive Design**: Mobile-first approach with Tailwind
