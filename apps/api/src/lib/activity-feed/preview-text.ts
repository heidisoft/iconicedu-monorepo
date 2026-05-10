import type { ActivityItemContentVM } from '@iconicedu/shared-types';

export const ACTIVITY_PREVIEW_MAX_LENGTH = 150;

export function truncatePreviewText(
  value: string | null | undefined,
  maxLength = ACTIVITY_PREVIEW_MAX_LENGTH,
) {
  if (typeof value !== 'string') {
    return value ?? undefined;
  }

  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function truncateActivityPreview(
  preview: ActivityItemContentVM['preview'],
): ActivityItemContentVM['preview'] {
  if (!preview) {
    return preview;
  }

  return {
    ...preview,
    text: truncatePreviewText(preview.text),
  };
}
