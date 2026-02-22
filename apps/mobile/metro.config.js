const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages
config.watchFolders = [monorepoRoot];

// Resolve packages from monorepo root node_modules first, then app-local
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const finalConfig = withNativeWind(config, { input: './global.css' });

// Force React/React Native to always resolve from the monorepo root's single copy.
// Must be applied AFTER withNativeWind (which returns a new config object).
// resolveRequest overrides resolution unconditionally — unlike extraNodeModules
// which only acts as a fallback when normal resolution fails.
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName === 'react/jsx-dev-runtime'
  ) {
    return {
      filePath: require.resolve(moduleName, { paths: [monorepoRoot] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = finalConfig;
