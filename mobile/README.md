# WatchSphere Mobile

Flutter mobile application for the WatchSphere watch trading platform.

## Features

- **Cross-Platform**: Single codebase for iOS and Android
- **Modern UI**: Material Design 3 with custom theming
- **State Management**: Riverpod for reactive state management
- **Navigation**: GoRouter for declarative routing
- **Real-time Updates**: WebSocket integration for live data
- **Offline Support**: Local caching with Hive

## Project Structure

```
mobile/
├── lib/
│   ├── core/
│   │   ├── config/          # App configuration
│   │   ├── constants/       # App constants
│   │   ├── theme/           # Theme and styling
│   │   ├── utils/           # Utility functions
│   │   └── router/          # Navigation setup
│   ├── features/
│   │   ├── home/            # Home screen with quick access
│   │   ├── market/          # Market listings and search
│   │   ├── dashboard/       # User dashboard & inventory
│   │   ├── chat/            # Messaging system
│   │   ├── profile/         # User profile
│   │   └── auth/            # Authentication
│   └── shared/
│       ├── models/          # Shared data models
│       ├── services/        # API and business logic
│       └── widgets/         # Reusable UI components
├── assets/
│   ├── images/              # Image assets
│   ├── icons/               # Icon assets
│   └── fonts/               # Custom fonts
└── test/                    # Unit and widget tests
```

## Feature Structure (per feature)

Each feature follows clean architecture:
```
feature_name/
├── data/
│   ├── models/              # Data models
│   ├── repositories/        # Data repositories
│   └── sources/             # Remote/local data sources
├── domain/
│   ├── entities/            # Business entities
│   ├── repositories/        # Repository interfaces
│   └── usecases/            # Business use cases
└── presentation/
    ├── providers/           # Riverpod providers
    ├── widgets/             # Feature-specific widgets
    └── screens/             # Feature screens
```

## Setup

### Prerequisites
- Flutter SDK (>=3.2.0)
- Dart SDK (>=3.2.0)
- Android Studio / Xcode
- VS Code with Flutter extension (optional)

### Installation

1. **Install Flutter**:
   - Follow [official Flutter installation guide](https://flutter.dev/docs/get-started/install)

2. **Install dependencies**:
   ```bash
   cd mobile
   flutter pub get
   ```

3. **Generate code** (for Riverpod and JSON serialization):
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

4. **Run the app**:
   ```bash
   # Run on connected device
   flutter run

   # Run on specific device
   flutter devices  # List available devices
   flutter run -d <device-id>

   # Run with hot reload
   flutter run --hot
   ```

## Key Screens to Implement

### 1. Home Screen
- Personalized greeting (time-based)
- Quick access buttons grid
- Customizable layout
- Market news feed

### 2. Market Screen
- Live market listings
- Smart search with filters
- Order book view
- Auction section

### 3. My Dashboard
- Inventory management
- Order tracking
- Analytics and insights
- Quick actions

### 4. Chats
- Direct dealer messages
- Group chats
- AI assistant chat
- Unread badge notifications

### 5. Profile
- Account settings
- Verification status
- Billing & subscriptions
- Preferences

## State Management

Using Riverpod for:
- API calls and data fetching
- Global state management
- Dependency injection
- Async data handling

Example:
```dart
final watchListProvider = FutureProvider<List<Watch>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  return api.getWatchList();
});
```

## API Integration

Configure the API base URL in `lib/core/config/app_config.dart`:
```dart
static const String apiBaseUrl = 'http://your-api-url/api/v1';
```

## Theming

Customize the app theme in `lib/core/theme/app_theme.dart`:
- Brand colors
- Typography
- Component themes
- Light/dark mode

## Development

- **Hot Reload**: Press `r` in terminal
- **Hot Restart**: Press `R` in terminal
- **Debug**: Use VS Code debugger or `flutter run --debug`

### Code Generation
When you modify:
- Riverpod providers
- JSON models
- API clients

Run:
```bash
flutter pub run build_runner watch
```

### Testing
```bash
# Run all tests
flutter test

# Run with coverage
flutter test --coverage

# Run specific test file
flutter test test/features/home/home_test.dart
```

## Building for Production

### Android
```bash
flutter build apk --release
# or
flutter build appbundle --release
```

### iOS
```bash
flutter build ios --release
```

## Architecture

Following **Clean Architecture** principles:
- **Presentation Layer**: UI and state management
- **Domain Layer**: Business logic and use cases
- **Data Layer**: API integration and data sources

Benefits:
- Testable
- Maintainable
- Scalable
- Independent of frameworks and UI

## Dependencies Overview

- **flutter_riverpod**: State management
- **go_router**: Declarative routing
- **dio**: HTTP client
- **hive**: Local storage
- **socket_io_client**: WebSocket for real-time
- **cached_network_image**: Image caching
- **google_fonts**: Typography
