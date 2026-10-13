const { expo: baseConfig } = require('./app.json');
const mobileLinks = require('../../ops/mobile-links.json');

const shortCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH?.slice(0, 7) ??
  process.env.GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  null;

module.exports = ({ config }) => ({
  ...baseConfig,
  ...config,
  ios: {
    ...baseConfig.ios,
    ...config.ios,
    associatedDomains: mobileLinks.domains.map((host) => `applinks:${host}`),
  },
  android: {
    ...baseConfig.android,
    ...config.android,
    intentFilters: [
      ...(config.android?.intentFilters ?? []),
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: mobileLinks.domains.map((host) => ({
          scheme: 'https',
          host,
          pathPrefix: '/live/',
        })),
      },
    ],
  },
  extra: {
    ...(baseConfig.extra ?? {}),
    ...(config.extra ?? {}),
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? null,
    easBuildId: process.env.EAS_BUILD_ID ?? null,
    easBuildProfile: process.env.EAS_BUILD_PROFILE ?? null,
    gitCommit: shortCommit,
  },
});
