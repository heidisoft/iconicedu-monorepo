export type MeetingBackgroundPreset = 'none' | 'blur' | `image:${string}`;
export type MeetingBackgroundPhoto = {
  value: `image:${string}`;
  label: string;
  filename: string;
};

const PHOTO = /\.(?:png|jpe?g|webp|avif|svg)$/i;

/**
 * Web and mobile ship the same meeting photos; naming them here keeps the
 * choices identical. Accepts bare filenames or `./name` directory-context keys,
 * and ignores nested paths so bundler aliases never become duplicate choices.
 */
export function buildMeetingBackgroundCatalog(files: string[]): MeetingBackgroundPhoto[] {
  return [
    ...new Set(
      files
        .map((key) => key.replace(/^\.\//, ''))
        .filter((filename) => !filename.includes('/') && PHOTO.test(filename)),
    ),
  ]
    .sort()
    .map((filename, index) => {
      const stem = filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      return {
        value: `image:${filename}` as const,
        // Stock-library names ("pexels dada 12277130") read as noise.
        label: stem.length > 32 || /\d{5}/.test(stem) ? `Background ${index + 1}` : stem,
        filename,
      };
    });
}
