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
  // Next also exposes module-resolution aliases in a context. Keep only files
  // directly inside this directory so aliases never become duplicate choices.
  return [
    ...new Set(
      files.filter((key) => /^\.\/[^/]+\.(?:png|jpe?g|webp|avif|svg)$/i.test(key)),
    ),
  ]
    .sort()
    .map((key, index) => {
      const filename = key.replace(/^\.\//, '');
      const stem = filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      return {
        value: `image:${filename}` as const,
        label: stem.length > 32 || /\d{5}/.test(stem) ? `Background ${index + 1}` : stem,
        src: `/live-session-backgrounds/${encodeURIComponent(filename)}`,
      };
    });
}

export const BACKGROUND_PRESETS = buildBackgroundCatalog(discoverFiles());
