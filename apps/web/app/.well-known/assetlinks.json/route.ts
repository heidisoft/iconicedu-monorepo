import links from '../../../../../ops/mobile-links.json';
// flag-exempt: platform association metadata for existing classroom links.
export function GET() {
  return Response.json(
    links.androidCertificateSha256.length
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: links.androidPackage,
              sha256_cert_fingerprints: links.androidCertificateSha256,
            },
          },
        ]
      : [],
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
