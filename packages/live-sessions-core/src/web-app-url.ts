const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

// Only needed by providers whose join_path is a full shareable URL rather than
// a path relative to the web app (e.g. Zoom Video SDK — see
// providers/zoom-video-sdk-provider.ts). Daily/Jitsi still return a relative
// `/orgSlug/live-sessions/:id` path that doesn't need this.
export function getWebAppUrl(): string {
  return (process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL).replace(/\/+$/, '');
}
