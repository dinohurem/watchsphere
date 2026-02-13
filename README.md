# WatchSphere

Premium watch trading platform connecting dealers and collectors worldwide.

## Overview

WatchSphere is a comprehensive platform for buying, selling, and trading luxury watches. It features real-time market data, smart search capabilities, AI-powered assistance, and secure dealer-to-dealer communication.

## Project Structure

This is a monorepo containing three main applications:

```
watchsphere/
├── backend/          # FastAPI backend with AI integration
├── mobile/           # Flutter mobile app (iOS & Android)
├── web/              # React web application
└── README.md         # This file
```

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **MongoDB** - Primary database
- **Redis** - Caching and real-time features
- **Beanie** - Async MongoDB ODM
- **WebSocket** - Real-time communication
- **AI Integration** - OpenAI & Anthropic for AI assistant

### Mobile
- **React Native (Expo)** - Cross-platform framework (iOS & Android)
- **Expo Router** - File-based navigation
- **Zustand** - State management
- **TanStack Query** - Server state management
- **Axios** - HTTP client
- **AsyncStorage** - Local storage

### Web
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Styling
- **Socket.io** - Real-time communication

## Core Features

### 1. Home Screen
- **Personalized Greeting** - Time-based welcome message
- **Quick Access Buttons**:
  - Activity Center
  - Smart Search
  - Buy/Sell
  - AI Assistant
  - Inventory Management
  - Order Tracking
  - Serial Checks
  - All Tools
- **Customizable Layout** - Users can rearrange their workspace
- **Market News Feed** - Latest industry updates

### 2. Market
- Live watch listings from verified dealers
- Smart search with advanced filters
- Order book view
- Auction section
- Real-time price updates

### 3. My Dashboard
- Inventory management
- Order tracking (buy & sell)
- Analytics and insights
- Quick actions

### 4. Chat
- Direct dealer messaging
- Group conversations
- AI assistant integration
- Real-time notifications
- Unread message badges

### 5. Profile
- Account settings
- Verification status
- Billing & subscriptions
- User preferences

### 6. Additional Features
- **Serial Number Checks** - Verify authenticity and avoid fraud
- **AI Assistant** - 24/7 help with market data, pricing, and advice
- **Smart Search** - Intelligent filtering across worldwide inventory
- **Activity Center** - Centralized notifications for matches, payments, shipping

## Getting Started

Each directory has its own README with detailed setup instructions:

- [Backend Setup](./backend/README.md)
- [Mobile Setup](./mobile/README.md)
- [Web Setup](./web/README.md)

### Quick Start (All Services)

1. **Backend**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   uvicorn app.main:app --reload
   ```

2. **Web**:
   ```bash
   cd web
   npm install
   cp .env.example .env
   npm run dev
   ```

3. **Mobile**:
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```

## Architecture

### Clean Architecture
All three applications follow clean architecture principles:
- **Presentation Layer** - UI components and state management
- **Domain Layer** - Business logic and use cases
- **Data Layer** - API integration and data sources

### Real-time Communication
- WebSocket connections for live updates
- Market price changes
- New messages
- Activity notifications

### AI Integration
The platform leverages AI for:
- Intelligent search and matching
- Price recommendations
- Market insights
- 24/7 user assistance
- Fraud detection

## API Endpoints

The backend exposes a RESTful API at `/api/v1/`:

- `/auth` - Authentication and user management
- `/market` - Market listings and search
- `/inventory` - User inventory management
- `/orders` - Buy and sell orders
- `/chat` - Messaging system
- `/ai` - AI assistant
- `/checks` - Serial number verification
- `/news` - Market news feed

Full API documentation available at: `http://localhost:8000/docs`

## Environment Setup

### Backend (.env)
```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=watchsphere
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Web (.env)
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000/ws
```

### Mobile
Configure in `lib/core/config/app_config.dart`

## Development Workflow

1. **Backend Development**:
   - Create database models in `app/models/`
   - Implement endpoints in `app/api/v1/endpoints/`
   - Business logic in `app/services/`
   - Run tests with `pytest`

2. **Web Development**:
   - Create feature components in `src/features/`
   - Shared components in `src/components/`
   - API services in `src/services/`
   - Run with hot reload: `npm run dev`

3. **Mobile Development**:
   - Create features in `lib/features/`
   - Shared code in `lib/shared/`
   - Run with hot reload: `flutter run --hot`

## Testing

- **Backend**: `pytest` with coverage
- **Web**: Jest and React Testing Library
- **Mobile**: Flutter's built-in testing framework

## Deployment

### Backend
- Docker container
- Deploy to AWS, GCP, or Azure
- Recommended: AWS ECS or Google Cloud Run

### Web
- Static build: `npm run build`
- Deploy to Vercel, Netlify, or AWS S3 + CloudFront

### Mobile
- Build APK/AAB for Android
- Build IPA for iOS
- Distribute via Google Play and App Store

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## Security

- JWT-based authentication
- Secure password hashing (bcrypt)
- HTTPS/WSS for all communication
- Input validation and sanitization
- Rate limiting
- NoSQL injection prevention via ODM

## Roadmap

- [ ] Phase 1: Core features (Auth, Market, Inventory)
- [ ] Phase 2: Real-time chat and notifications
- [ ] Phase 3: AI assistant integration
- [ ] Phase 4: Advanced analytics
- [ ] Phase 5: Mobile app release
- [ ] Phase 6: Payment integration
- [ ] Phase 7: Auction system
- [ ] Phase 8: Social features

## License

Proprietary - All rights reserved

## Support

For issues and questions:
- Backend: See [backend/README.md](./backend/README.md)
- Web: See [web/README.md](./web/README.md)
- Mobile: See [mobile/README.md](./mobile/README.md)

---

Install dependencies:
npm install  # Root

Set up MongoDB:
# Install MongoDB or use MongoDB Atlas
# Update apps/backend/.env:
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=watchsphere
Start developing:
# Backend
cd apps/backend
source venv/bin/activate
cd apps/backend && uvicorn app.main:app --reload

# Web
cd apps/web && npm run dev

# Mobile
cd apps/mobile && npx expo start



📧 Email:    admin@watchsphere.com
🔑 Password: Admin123!


DEALER:
  Email: dealer@watchsphere.com
  Password: Dealer123!

COLLECTOR:
  Email: collector@watchsphere.com
  Password: Collector123!


from mobile folder:
  eas build --platform android --profile production --local
  eas build --platform ios --profile production --local


Running builds:

1. 
cd /Users/dinohurem/Documents/dev/watchsphere/apps/mobile
./scripts/prepare-standalone-build.sh

2. 
Then copy the watchsphere-release.keystore to folder.
cp /Users/dinohurem/Documents/dev/watchsphere/apps/mobile/android/app/watchsphere-release.keystore ~/watchsphere-standalone-build/android/app/


3.
then this:
cd ~/watchsphere-standalone-build/android
./gradlew bundleRelease

npx expo run:ios
 NODE_ENV=production npx expo run:ios --no-build-cache 

  NODE_ENV=production npx expo run:ios




#### MOBILE APP

  Development (uses .env.development / .env)                                                                                                         
                                                                                                                                                     
  npx expo run:ios                                                                                                                                   
  This builds the native binary, starts Metro, installs on the simulator, and opens the app.                                                         
                                                                                                                                                     
  Production env vars

  NODE_ENV=production npx expo run:ios  --no-build-cache 
  Expo loads .env.production when NODE_ENV=production is set. This will use your Railway production API URLs.

  Other useful variants

  # Clear Metro cache (if you changed babel/metro config)
  npx expo start --clear

  # Just start Metro (if native binary is already built/installed)
  npx expo start