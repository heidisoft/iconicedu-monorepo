/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Temporary deploy unblock: lint still runs via separate scripts/CI checks.
    ignoreDuringBuilds: true,
  },
  // Transpile shared UI package from source instead of relying on a prebuilt bundle.
  transpilePackages: ['@iconicedu/ui-web', '@iconicedu/utils'],
};

export default nextConfig;
