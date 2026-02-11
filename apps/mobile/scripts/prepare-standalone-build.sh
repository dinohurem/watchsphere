#!/bin/bash

# Standalone Build Preparation Script for WatchSphere Mobile
# This script creates a standalone copy of the mobile app outside the monorepo
# for local Android/iOS builds without EAS cloud.

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(dirname "$(dirname "$MOBILE_DIR")")"
BUILD_DIR="$HOME/watchsphere-standalone-build"

echo "=== WatchSphere Standalone Build Preparation ==="
echo "Mobile app: $MOBILE_DIR"
echo "Monorepo root: $MONOREPO_ROOT"
echo "Build directory: $BUILD_DIR"
echo ""

# Clean previous build directory
if [ -d "$BUILD_DIR" ]; then
    echo "Removing previous build directory..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
echo "Creating build directory..."
mkdir -p "$BUILD_DIR"

# Copy mobile app files (excluding node_modules and native directories)
echo "Copying mobile app files..."
rsync -av --progress "$MOBILE_DIR/" "$BUILD_DIR/" \
    --exclude 'node_modules' \
    --exclude 'android' \
    --exclude 'ios' \
    --exclude '.expo' \
    --exclude 'dist' \
    --exclude '.easignore' \
    --exclude '.npmrc' \
    --exclude 'scripts'

# Copy shared package
echo "Copying shared package..."
mkdir -p "$BUILD_DIR/packages/shared"
rsync -av --progress "$MONOREPO_ROOT/packages/shared/" "$BUILD_DIR/packages/shared/" \
    --exclude 'node_modules'

# Update package.json to use local shared package path and remove workspace markers
echo "Updating package.json..."
cd "$BUILD_DIR"

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Update shared package reference to local path
if (pkg.dependencies && pkg.dependencies['@watchsphere/shared']) {
    pkg.dependencies['@watchsphere/shared'] = 'file:./packages/shared';
}

// Remove workspaces if present
delete pkg.workspaces;

// Ensure exact versions for critical packages (SDK 52 compatible)
pkg.dependencies['react-native'] = '0.76.5';
pkg.dependencies['react-native-svg'] = '15.8.0';
pkg.dependencies['@shopify/flash-list'] = '1.7.1';
pkg.dependencies['expo-image-picker'] = '~16.0.4';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Updated package.json');
"

# Also update shared package if it has workspace references
if [ -f "$BUILD_DIR/packages/shared/package.json" ]; then
    echo "Updating shared package.json..."
    node -e "
    const fs = require('fs');
    const pkgPath = './packages/shared/package.json';
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    delete pkg.workspaces;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Updated shared package.json');
    "
fi

# Install dependencies with legacy peer deps
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Fix expo dependencies
echo "Fixing expo dependencies..."
npx expo install --fix

# Run expo prebuild for Android
echo "Running expo prebuild for Android..."
npx expo prebuild --clean --platform android

# Configure release signing
echo "Configuring release signing..."

# Add signing config to gradle.properties
cat >> "$BUILD_DIR/android/gradle.properties" << 'EOF'

# Release signing config
WATCHSPHERE_UPLOAD_STORE_FILE=watchsphere-release.keystore
WATCHSPHERE_UPLOAD_KEY_ALIAS=watchsphere
WATCHSPHERE_UPLOAD_STORE_PASSWORD=Cerberus1234\#$
WATCHSPHERE_UPLOAD_KEY_PASSWORD=Cerberus1234\#$
EOF

# Update build.gradle with release signing config
GRADLE_FILE="$BUILD_DIR/android/app/build.gradle"

# Create a node script to properly modify build.gradle
node -e "
const fs = require('fs');
let content = fs.readFileSync('$GRADLE_FILE', 'utf8');

// Add release signing config after debug signing config
const debugConfigEnd = content.indexOf('}', content.indexOf('signingConfigs {') + content.substring(content.indexOf('signingConfigs {')).indexOf('debug {') + 50);
const insertPoint = content.indexOf('}', debugConfigEnd) + 1;

const releaseConfig = \`
        release {
            if (project.hasProperty('WATCHSPHERE_UPLOAD_STORE_FILE')) {
                storeFile file(WATCHSPHERE_UPLOAD_STORE_FILE)
                storePassword WATCHSPHERE_UPLOAD_STORE_PASSWORD
                keyAlias WATCHSPHERE_UPLOAD_KEY_ALIAS
                keyPassword WATCHSPHERE_UPLOAD_KEY_PASSWORD
            }
        }\`;

content = content.substring(0, insertPoint) + releaseConfig + content.substring(insertPoint);

// Replace signingConfig in release buildType: change debug to release
// Match the release block in buildTypes and replace signingConfigs.debug with signingConfigs.release
content = content.replace(
    /(buildTypes\\s*\\{[\\s\\S]*?release\\s*\\{[\\s\\S]*?signingConfig\\s+signingConfigs\\.)debug/,
    '\$1release'
);

fs.writeFileSync('$GRADLE_FILE', content);
console.log('Updated build.gradle with release signing config');
"

# Copy keystore if it exists (check multiple locations)
KEYSTORE_SOURCE="$MONOREPO_ROOT/watchsphere-release.keystore"
KEYSTORE_SOURCE_ALT="$MOBILE_DIR/android/app/watchsphere-release.keystore"

if [ -f "$KEYSTORE_SOURCE" ]; then
    echo "Copying release keystore from monorepo root..."
    cp "$KEYSTORE_SOURCE" "$BUILD_DIR/android/app/"
    echo "Keystore copied successfully!"
elif [ -f "$KEYSTORE_SOURCE_ALT" ]; then
    echo "Copying release keystore from mobile app..."
    cp "$KEYSTORE_SOURCE_ALT" "$BUILD_DIR/android/app/"
    echo "Keystore copied successfully!"
else
    echo "WARNING: Keystore not found at $KEYSTORE_SOURCE or $KEYSTORE_SOURCE_ALT"
    echo "You will need to create or copy one manually."
fi

echo ""
echo "=== Standalone build prepared successfully! ==="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Create a keystore (if you haven't already):"
echo "   cd $BUILD_DIR/android/app"
echo "   keytool -genkeypair -v -storetype PKCS12 -keystore watchsphere-release.keystore -alias watchsphere -keyalg RSA -keysize 2048 -validity 10000"
echo ""
echo "2. Build the Android AAB:"
echo "   cd $BUILD_DIR/android"
echo "   ./gradlew bundleRelease"
echo ""
echo "3. Output will be at:"
echo "   $BUILD_DIR/android/app/build/outputs/bundle/release/app-release.aab"
