/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Temporary deploy unblock: lint still runs via separate scripts/CI checks.
    ignoreDuringBuilds: true,
  },
  // Transpile shared UI package from source instead of relying on a prebuilt bundle.
  transpilePackages: ['@iconicedu/ui-web', '@iconicedu/utils'],
  env: {
    NEXT_PUBLIC_POSTHOG_KEY:
      process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
    NEXT_PUBLIC_POSTHOG_HOST:
      process.env.POSTHOG_HOST ??
      process.env.NEXT_PUBLIC_POSTHOG_HOST ??
      'https://t.iconicedu.lk',
  },
};

export default nextConfig;
