import { buildMeetingBackgroundCatalog } from '@iconicedu/utils';

// Webpack watches this directory in development and discovers files at build
// time in production. Only filenames enter the client bundle; images remain
// served from public, without importing their bytes into the settings UI.
// A lazy context retains directory dependencies for hot reload. A weak context
// can leave an already-open settings gallery with an outdated file list.
declare const require: {
  context: (
    directory: string,
    recursive: boolean,
    pattern: RegExp,
    mode: 'lazy',
  ) => { keys(): string[] };
};
function discoverFiles(): string[] {
  try {
    return require
      .context(
        '../../public/live-session-backgrounds',
        false,
        /\.(?:png|jpe?g|webp|avif|svg)$/i,
        'lazy',
      )
      .keys();
  } catch {
    // Non-webpack test environments do not provide directory contexts.
    return [];
  }
}
export function buildBackgroundCatalog(files: string[]) {
  return buildMeetingBackgroundCatalog(files).map(({ value, label, filename }) => ({
    value,
    label,
    src: `/live-session-backgrounds/${encodeURIComponent(filename)}`,
  }));
}

export const BACKGROUND_PRESETS = buildBackgroundCatalog(discoverFiles());
