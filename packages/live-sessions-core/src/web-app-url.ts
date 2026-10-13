const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

// Only needed by providers whose join_path is a full shareable URL rather than
// a path relative to the web app (e.g. Zoom Video SDK — see
// providers/zoom-video-sdk-provider.ts). Daily/Jitsi still return a relative
// `/orgSlug/live-sessions/:id` path that doesn't need this.
//
// Reads WEB_URL — the same env var already used for the web app's base URL
// elsewhere in the repo (mobile EAS builds, apps/web's getSiteUrl()) — rather
// than a separate WEB_APP_URL, so this doesn't need its own redundant
// deployment config.
export function getWebAppUrl(): string {
  return (process.env.WEB_URL ?? DEFAULT_WEB_APP_URL).replace(/\/+$/, '');
}
