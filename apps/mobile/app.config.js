const { expo: baseConfig } = require('./app.json');

const shortCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH?.slice(0, 7) ??
  process.env.GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  null;

module.exports = ({ config }) => ({
  ...baseConfig,
  ...config,
  extra: {
    ...(baseConfig.extra ?? {}),
    ...(config.extra ?? {}),
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? null,
    easBuildId: process.env.EAS_BUILD_ID ?? null,
    easBuildProfile: process.env.EAS_BUILD_PROFILE ?? null,
    gitCommit: shortCommit,
  },
});
