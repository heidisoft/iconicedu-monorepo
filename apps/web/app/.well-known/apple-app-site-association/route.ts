import links from '../../../../../ops/mobile-links.json';
// flag-exempt: platform association metadata for existing classroom links.
export function GET() {
  return Response.json(
    {
      applinks: {
        apps: [],
        details: links.iosApplicationIdentifiers.map((appID) => ({
          appID,
          paths: ['/live/*'],
        })),
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
