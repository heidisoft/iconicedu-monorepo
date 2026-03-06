/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Temporary deploy unblock: lint still runs via separate scripts/CI checks.
    ignoreDuringBuilds: true,
  },
  // Transpile shared UI package from source instead of relying on a prebuilt bundle.
  transpilePackages: ['@iconicedu/ui-web', '@iconicedu/utils'],

  // Route PostHog ingestion through our own domain so ad blockers and
  // strict network policies don't silently drop analytics events.
  // Required companion: skipTrailingSlashRedirect (PostHog uses trailing slashes).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
};

export default nextConfig;
