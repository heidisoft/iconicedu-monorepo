const appJson = require('./app.json');

const expoConfig = appJson.expo ?? {};

module.exports = () => ({
  ...expoConfig,
  extra: {
    ...(expoConfig.extra ?? {}),
    iconicEnvName: process.env.ICONIC_ENV_NAME ?? '',
    iconicEnvTier: process.env.ICONIC_ENV_TIER ?? '',
    previewBranch: process.env.ICONIC_PREVIEW_BRANCH ?? '',
    previewRef: process.env.ICONIC_PREVIEW_REF ?? '',
    supabaseProjectRef: process.env.SUPABASE_PROJECT_REF ?? '',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? expoConfig.extra?.eas?.projectId ?? '',
    },
  },
});
