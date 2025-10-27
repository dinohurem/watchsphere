# WatchSphere Setup Guide

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Python** >= 3.10
- **MongoDB** (local or MongoDB Atlas)
- **Redis** (optional, for caching)

## Installation Steps

### 1. Install Dependencies

```bash
# Install all workspace dependencies from root
npm install

# Install Python dependencies for backend
cd apps/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 2. Set Up Environment Variables

#### Backend
```bash
cd apps/backend
cp .env.example .env
```

Edit `apps/backend/.env`:
```env
# Application
APP_NAME=WatchSphere
DEBUG=True
ENVIRONMENT=development

# API
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=watchsphere

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# AI Services (optional for testing)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8081
```

#### Web
```bash
cd apps/web
cp .env.example .env
```

Edit `apps/web/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000/ws
```

### 3. Set Up MongoDB

#### Option A: Local MongoDB
```bash
# Install MongoDB Community Edition
# macOS
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Or run manually
mongod --config /usr/local/etc/mongod.conf
```

#### Option B: MongoDB Atlas (Cloud)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get your connection string
4. Update `MONGODB_URL` in `apps/backend/.env`:
   ```env
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   ```

### 4. Start Development Servers

Open 3 separate terminal windows:

#### Terminal 1: Backend
```bash
cd apps/backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```
Backend will run at: http://localhost:8000
API Docs: http://localhost:8000/docs

#### Terminal 2: Web
```bash
cd apps/web
npm run dev
```
Web app will run at: http://localhost:5173

#### Terminal 3: Mobile
```bash
cd apps/mobile
npx expo start
```
Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Troubleshooting

### npm install errors
If you get `ENOTEMPTY` errors:
```bash
# Clean everything and reinstall
rm -rf node_modules package-lock.json apps/*/node_modules packages/*/node_modules
npm install
```

### MongoDB connection errors
- Make sure MongoDB is running: `brew services list` (macOS)
- Check connection string in `.env`
- For Atlas, make sure your IP is whitelisted

### Expo not starting
```bash
# Clear Expo cache
cd apps/mobile
npx expo start -c
```

### Backend errors
```bash
# Make sure virtual environment is activated
cd apps/backend
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Project Structure

```
watchsphere/
├── apps/
│   ├── backend/         # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/     # API endpoints
│   │   │   ├── models/  # MongoDB models
│   │   │   ├── core/    # Config & security
│   │   │   └── db/      # Database session
│   │   └── requirements.txt
│   ├── web/             # React web app
│   │   └── src/
│   └── mobile/          # React Native (Expo)
│       ├── app/         # Expo Router pages
│       ├── src/
│       │   ├── components/
│       │   ├── services/
│       │   └── theme/   # Design system
│       └── package.json
├── packages/
│   └── shared/          # Shared code
└── package.json         # Root workspace config
```

## Next Steps

1. **Backend**: Start creating API endpoints in `apps/backend/app/api/v1/endpoints/`
2. **Web**: Build UI components in `apps/web/src/features/`
3. **Mobile**: Implement screens using the theme system in `apps/mobile/src/theme/`
4. **Design**: Reference [apps/mobile/DESIGN_REFERENCE.md](apps/mobile/DESIGN_REFERENCE.md) for styling

## Useful Commands

```bash
# Run all dev servers (requires turbo)
npm run dev

# Lint all projects
npm run lint

# Type check all projects
npm run type-check

# Build all projects
npm run build

# Clean all dependencies
npm run clean
```

## Resources

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Beanie ODM](https://beanie-odm.dev/)
- [React Docs](https://react.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [MongoDB Docs](https://www.mongodb.com/docs/)

## Support

For issues or questions, check:
- Backend: [apps/backend/README.md](apps/backend/README.md)
- Web: [apps/web/README.md](apps/web/README.md)
- Mobile: [apps/mobile/README.md](apps/mobile/README.md)
