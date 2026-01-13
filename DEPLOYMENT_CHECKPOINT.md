# WatchSphere Deployment Checkpoint

**Date:** January 13, 2026
**Version:** 0.1.0
**Branch:** dh-backend

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Backend Deployment (Vercel)](#backend-deployment-vercel)
4. [Web Deployment (Vercel)](#web-deployment-vercel)
5. [Mobile Deployment (iOS & Android)](#mobile-deployment-ios--android)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Outstanding TODOs](#outstanding-todos)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

WatchSphere is a luxury watch marketplace platform consisting of:

| App | Technology | Deployment Target |
|-----|------------|-------------------|
| **Backend** | FastAPI (Python 3.11+) | Vercel Serverless |
| **Web** | React + Vite + TypeScript | Vercel Static |
| **Mobile** | Expo + React Native | App Store / Play Store |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │   Web App    │     │  Mobile App  │     │  Mobile App  │   │
│   │   (Vercel)   │     │    (iOS)     │     │  (Android)   │   │
│   │              │     │   App Store  │     │  Play Store  │   │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│          │                    │                    │            │
│          └────────────────────┼────────────────────┘            │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────┐                         │
│                    │   Backend API    │                         │
│                    │    (Vercel)      │                         │
│                    │   api.domain.io  │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│   │  MongoDB   │    │   Redis    │    │  Firebase  │           │
│   │   Atlas    │    │   Cloud    │    │  Storage   │           │
│   └────────────┘    └────────────┘    └────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### Required Accounts & Services

- [ ] **Vercel Account** - For web and backend hosting
- [ ] **MongoDB Atlas** - Production database cluster
- [ ] **Redis Cloud** (Upstash recommended for Vercel) - Caching layer
- [ ] **Firebase Project** - Storage bucket configured
- [ ] **Postmark** - Email service API key
- [ ] **Monri** - Payment gateway credentials
- [ ] **OpenAI** - API key for AI features
- [ ] **Google Cloud Console** - OAuth credentials
- [ ] **Apple Developer Account** ($99/year) - For iOS deployment
- [ ] **Google Play Developer Account** ($25 one-time) - For Android deployment

### Domain Configuration

- [ ] Primary domain: `watchsphere.io` (or your domain)
- [ ] API subdomain: `api.watchsphere.io`
- [ ] Configure DNS records in your domain provider

---

## Backend Deployment (Vercel)

### Step 1: Prepare Backend for Vercel

Vercel supports Python serverless functions. Create the following configuration files:

**1.1 Create `apps/backend/vercel.json`:**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/main.py"
    }
  ]
}
```

**1.2 Update `apps/backend/requirements.txt`** (ensure all dependencies are listed)

The current requirements.txt is already configured. Verify it includes:
- fastapi
- uvicorn
- motor (async MongoDB)
- beanie (ODM)
- redis
- python-jose (JWT)
- All other dependencies

**1.3 Create `apps/backend/api/index.py`** (Vercel entry point):

```python
from app.main import app

# Vercel expects the app to be named 'app' or 'handler'
handler = app
```

### Step 2: Deploy Backend to Vercel

**2.1 Install Vercel CLI:**

```bash
npm install -g vercel
```

**2.2 Login to Vercel:**

```bash
vercel login
```

**2.3 Navigate to backend directory:**

```bash
cd apps/backend
```

**2.4 Initialize Vercel project:**

```bash
vercel
```

Follow the prompts:
- Set up and deploy: `Y`
- Scope: Select your account/team
- Link to existing project: `N` (first time)
- Project name: `watchsphere-api`
- Directory: `./`
- Override settings: `N`

**2.5 Configure Environment Variables in Vercel Dashboard:**

Go to [vercel.com](https://vercel.com) → Your Project → Settings → Environment Variables

Add all required environment variables (see [Environment Variables Reference](#environment-variables-reference))

**2.6 Configure Custom Domain:**

In Vercel Dashboard → Your Project → Settings → Domains:
- Add `api.watchsphere.io`
- Follow DNS configuration instructions

**2.7 Deploy to Production:**

```bash
vercel --prod
```

### Step 3: Verify Backend Deployment

```bash
# Test health endpoint
curl https://api.watchsphere.io/health

# Test API docs
open https://api.watchsphere.io/docs
```

---

## Web Deployment (Vercel)

### Step 1: Prepare Web App

**1.1 Verify build works locally:**

```bash
cd apps/web
npm run build
npm run preview  # Test production build locally
```

**1.2 Create `apps/web/vercel.json`:**

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Step 2: Deploy Web to Vercel

**2.1 Navigate to web directory:**

```bash
cd apps/web
```

**2.2 Initialize Vercel project:**

```bash
vercel
```

Follow the prompts:
- Project name: `watchsphere-web`
- Framework: Vite (auto-detected)

**2.3 Configure Environment Variables:**

In Vercel Dashboard → watchsphere-web → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://api.watchsphere.io/api/v1` |
| `VITE_WS_BASE_URL` | `wss://api.watchsphere.io/ws` |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `VITE_APPLE_CLIENT_ID` | Your Apple Client ID |

**2.4 Configure Custom Domain:**

In Vercel Dashboard → watchsphere-web → Settings → Domains:
- Add `watchsphere.io`
- Add `www.watchsphere.io`

**2.5 Deploy to Production:**

```bash
vercel --prod
```

### Step 3: Verify Web Deployment

```bash
open https://watchsphere.io
```

Test:
- [ ] Homepage loads correctly
- [ ] API connection works (try logging in)
- [ ] WebSocket connection establishes
- [ ] OAuth buttons work
- [ ] All routes work (SPA routing)

---

## Mobile Deployment (iOS & Android)

### Prerequisites

Before building for app stores, you need:

**For iOS:**
- [ ] Apple Developer Program membership ($99/year)
- [ ] App Store Connect account
- [ ] Distribution certificate
- [ ] Provisioning profiles (App Store distribution)
- [ ] App ID registered in Apple Developer Portal

**For Android:**
- [ ] Google Play Developer account ($25 one-time)
- [ ] App signing key (keystore)
- [ ] Google Play Console project created

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure EAS Build

**2.1 Create `apps/mobile/eas.json`:**

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**2.2 Update `apps/mobile/app.json` for production:**

```json
{
  "expo": {
    "name": "WatchSphere",
    "slug": "watchsphere",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1A1A1A"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.watchsphere.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "WatchSphere needs camera access to take photos of watches",
        "NSPhotoLibraryUsageDescription": "WatchSphere needs photo library access to upload watch images"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1A1A1A"
      },
      "package": "com.watchsphere.app",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "color": "#000000"
        }
      ],
      "expo-font"
    ],
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

### Step 3: Create Production Environment

**3.1 Create `apps/mobile/.env.production`:**

```env
EXPO_PUBLIC_API_BASE_URL=https://api.watchsphere.io/api/v1
EXPO_PUBLIC_WS_BASE_URL=wss://api.watchsphere.io/ws
EXPO_PUBLIC_WEB_URL=https://watchsphere.io
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id
```

### Step 4: Build for iOS (IPA)

**4.1 Configure Apple credentials:**

```bash
eas credentials
```

Select iOS → Production → Set up credentials

This will guide you through:
- Creating/selecting distribution certificate
- Creating/selecting provisioning profile

**4.2 Build IPA:**

```bash
cd apps/mobile
eas build --platform ios --profile production
```

The build will:
1. Upload to EAS build servers
2. Build the IPA
3. Sign with your credentials
4. Provide download link

**4.3 Submit to App Store:**

```bash
eas submit --platform ios
```

Or manually upload via Transporter app.

### Step 5: Build for Android (AAB)

**5.1 Create upload keystore (first time only):**

```bash
eas credentials
```

Select Android → Production → Keystore → Generate new

**IMPORTANT:** Save the keystore credentials securely! You cannot recover them.

**5.2 Build AAB:**

```bash
cd apps/mobile
eas build --platform android --profile production
```

**5.3 Submit to Play Store:**

```bash
eas submit --platform android
```

Or manually upload via Google Play Console.

### Step 6: App Store Submission Checklist

**iOS App Store Connect:**
- [ ] App name and description
- [ ] Screenshots (6.5" and 5.5" iPhone, iPad if supported)
- [ ] App icon (1024x1024)
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Age rating questionnaire
- [ ] App Review Information

**Google Play Console:**
- [ ] App name and description
- [ ] Screenshots (phone, 7" tablet, 10" tablet)
- [ ] Feature graphic (1024x500)
- [ ] High-res icon (512x512)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience and content

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_NAME` | Application name | `WatchSphere` |
| `DEBUG` | Debug mode (set to False in prod) | `False` |
| `ENVIRONMENT` | Environment name | `production` |
| `SECRET_KEY` | JWT secret key (generate secure random) | `your-256-bit-secret` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `30` |
| `MONGODB_URL` | MongoDB connection string | `mongodb+srv://...` |
| `MONGODB_DB_NAME` | Database name | `watchsphere_prod` |
| `REDIS_URL` | Redis connection (use Upstash for Vercel) | `redis://...` |
| `MONRI_MERCHANT_KEY` | Monri payment key | `...` |
| `MONRI_AUTHENTICITY_TOKEN` | Monri auth token | `...` |
| `MONRI_API_URL` | Monri API endpoint | `https://ipg.monri.com` |
| `POSTMARK_API_KEY` | Postmark email API key | `...` |
| `EMAIL_FROM` | Sender email | `hello@watchsphere.io` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase credentials path | `./firebase-creds.json` |
| `FIREBASE_STORAGE_BUCKET` | Firebase bucket | `watchsphere.appspot.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `...googleusercontent.com` |
| `APPLE_CLIENT_ID` | Apple OAuth client ID | `com.watchsphere.app` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `https://watchsphere.io` |

### Web Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `https://api.watchsphere.io/api/v1` |
| `VITE_WS_BASE_URL` | WebSocket URL | `wss://api.watchsphere.io/ws` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | `...googleusercontent.com` |
| `VITE_APPLE_CLIENT_ID` | Apple OAuth client ID | `com.watchsphere.app` |

### Mobile Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API URL | `https://api.watchsphere.io/api/v1` |
| `EXPO_PUBLIC_WS_BASE_URL` | WebSocket URL | `wss://api.watchsphere.io/ws` |
| `EXPO_PUBLIC_WEB_URL` | Web app URL | `https://watchsphere.io` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google web client | `...` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google iOS client | `...` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Android client | `...` |

---

## Post-Deployment Verification

### Backend Verification

```bash
# 1. Health check
curl https://api.watchsphere.io/health

# 2. API documentation
open https://api.watchsphere.io/docs

# 3. Test authentication endpoint
curl -X POST https://api.watchsphere.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'

# 4. Check WebSocket connection
wscat -c wss://api.watchsphere.io/ws
```

### Web Verification

- [ ] Homepage loads (`https://watchsphere.io`)
- [ ] All routes work (test navigation)
- [ ] Login/Register works
- [ ] API calls succeed (check network tab)
- [ ] WebSocket connects (check console)
- [ ] Images load from Firebase
- [ ] Responsive design works

### Mobile Verification

- [ ] App installs correctly
- [ ] Splash screen displays
- [ ] Login/Register works
- [ ] Push notifications work
- [ ] Camera/Photo access works
- [ ] Deep links work
- [ ] OAuth (Google/Apple) works

---

## Outstanding TODOs

The following items were found in the codebase and should be addressed:

### Backend TODOs

| File | Line | Description | Priority |
|------|------|-------------|----------|
| [upload.py:192](apps/backend/app/api/v1/endpoints/upload.py#L192) | 192 | Add authorization check to ensure user owns the image | **High** |
| [profile.py:261](apps/backend/app/api/v1/endpoints/profile.py#L261) | 261 | Calculate priceChange from market data | Medium |
| [profile.py:262](apps/backend/app/api/v1/endpoints/profile.py#L262) | 262 | Get image from market data | Medium |

### Mobile TODOs

| File | Line | Description | Priority |
|------|------|-------------|----------|
| [general.tsx:166](apps/mobile/app/settings/general.tsx#L166) | 166 | Open language picker modal | Low |
| [chat/[id].tsx:399](apps/mobile/app/chat/[id].tsx#L399) | 399 | Implement image upload and send in chat | Medium |

### Pre-Deployment Action Items

- [ ] **Security:** Fix authorization check in upload.py before production
- [ ] **Feature:** Implement image upload in mobile chat
- [ ] **Enhancement:** Add price change calculation from market data
- [ ] **UX:** Implement language picker modal

---

## Troubleshooting

### Backend Issues

**Problem:** MongoDB connection fails
```
Solution: Check MONGODB_URL format and whitelist Vercel IPs in MongoDB Atlas
- Go to MongoDB Atlas → Network Access → Add IP Address
- Add 0.0.0.0/0 for Vercel (or use connection string with srv)
```

**Problem:** Redis connection fails
```
Solution: Use Upstash Redis which is optimized for serverless
- Create account at upstash.com
- Create Redis database
- Use the provided REST URL
```

**Problem:** CORS errors
```
Solution: Update ALLOWED_ORIGINS in backend environment variables
- Add all frontend domains including www subdomain
```

### Web Issues

**Problem:** API calls fail with CORS
```
Solution: Ensure backend ALLOWED_ORIGINS includes your domain
```

**Problem:** Routes return 404
```
Solution: Verify vercel.json has SPA rewrite rule
```

**Problem:** Environment variables not working
```
Solution: Vite requires VITE_ prefix for client-side env vars
- Rebuild after adding variables
```

### Mobile Issues

**Problem:** EAS build fails
```
Solution: Check eas.json configuration and credentials
eas build --platform ios --profile production --clear-cache
```

**Problem:** App crashes on launch
```
Solution: Check environment variables are set correctly
- Verify API URL is accessible
- Check for missing native dependencies
```

**Problem:** Push notifications not working
```
Solution: Verify push credentials in EAS
eas credentials --platform ios
```

---

## Quick Reference Commands

```bash
# Backend
cd apps/backend
vercel --prod                    # Deploy to production

# Web
cd apps/web
npm run build                    # Build locally
vercel --prod                    # Deploy to production

# Mobile
cd apps/mobile
eas build --platform ios         # Build iOS
eas build --platform android     # Build Android
eas build --platform all         # Build both
eas submit --platform ios        # Submit to App Store
eas submit --platform android    # Submit to Play Store

# Logs
vercel logs                      # View deployment logs
eas build:list                   # List builds
```

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Expo/EAS Docs:** https://docs.expo.dev/build/introduction/
- **MongoDB Atlas:** https://www.mongodb.com/docs/atlas/
- **Upstash Redis:** https://upstash.com/docs/redis/overall/getstarted

---

*Last Updated: January 13, 2026*
