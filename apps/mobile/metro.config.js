const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// In this monorepo, react-native 0.76.5 is hoisted to the root node_modules
// while react-native 0.81.5 is in apps/mobile/node_modules. When Metro
// processes files from hoisted packages (expo, etc.) in root node_modules,
// hierarchical (Node-style) resolution walks up and finds 0.76.5 instead of
// 0.81.5. The JS TurboModuleRegistry from 0.76.5 is incompatible with the
// native binary built against 0.81.5, causing "PlatformConstants could not
// be found" crashes.
//
// Fix: restrict nodeModulesPaths to mobile first, then root, and pin
// react-native + @react-native/* to always resolve from mobile's node_modules.

// Watch the monorepo root so Metro can resolve packages hoisted there.
config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Do NOT use disableHierarchicalLookup — it breaks internal package resolution
// (e.g. react-native/Libraries/* can't find @react-native/virtualized-lists).
// Instead, use resolveRequest to pin specific packages to mobile's versions.

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force axios to use browser build instead of Node.js build
  if (moduleName === 'axios') {
    return {
      filePath: require.resolve('axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }

  // Pin react-native, react, and @react-native/* to mobile's node_modules to
  // prevent resolving the wrong version from root node_modules.
  // Root has react-native 0.76.5 + react 18.3.1, mobile has 0.83.1 + 19.2.0.
  if (
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/') ||
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react-dom/') ||
    moduleName.startsWith('@react-native/')
  ) {
    return context.resolveRequest(
      { ...context, nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')] },
      moduleName,
      platform,
    );
  }

  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
