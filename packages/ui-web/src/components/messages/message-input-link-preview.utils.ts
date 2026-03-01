const URL_PATTERN = /(https?:\/\/[^\s]+)/i;

export function extractComposerLinkPreviewUrl(text: string) {
  return text.match(URL_PATTERN)?.[1] ?? null;
}

export function shouldShowComposerLinkPreview(
  previewUrl: string | null,
  dismissedUrl: string | null,
) {
  if (!previewUrl) {
    return false;
  }

  return previewUrl !== dismissedUrl;
}
