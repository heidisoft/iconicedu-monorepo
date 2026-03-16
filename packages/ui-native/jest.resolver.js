/**
 * Custom jest resolver that extends react-native's resolver.
 *
 * Removes the `exports` field from packages whose internal paths
 * are accessed by jest-expo's setup (e.g., expo-modules-core/src/Refs).
 */
'use strict';

const STRIP_EXPORTS_PACKAGES = new Set(['react-native', 'expo-modules-core', 'expo']);

module.exports = (path, options) => {
  const originalPackageFilter = options.packageFilter;

  return options.defaultResolver(path, {
    ...options,
    packageFilter: (pkg) => {
      const filteredPkg = originalPackageFilter ? originalPackageFilter(pkg) : pkg;

      if (STRIP_EXPORTS_PACKAGES.has(filteredPkg.name)) {
        delete filteredPkg.exports;
      }

      return filteredPkg;
    },
  });
};
