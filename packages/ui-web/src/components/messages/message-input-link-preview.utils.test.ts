import { describe, expect, it } from 'vitest';

import {
  extractComposerLinkPreviewUrl,
  shouldShowComposerLinkPreview,
} from './message-input-link-preview.utils';

describe('extractComposerLinkPreviewUrl', () => {
  it('returns the first url in composer text', () => {
    expect(
      extractComposerLinkPreviewUrl('Check this https://example.com/post and respond'),
    ).toBe('https://example.com/post');
  });

  it('returns null when no url exists', () => {
    expect(extractComposerLinkPreviewUrl('No links here')).toBeNull();
  });

  it('hides the preview when the same url was dismissed', () => {
    expect(
      shouldShowComposerLinkPreview(
        'https://example.com/post',
        'https://example.com/post',
      ),
    ).toBe(false);
  });

  it('shows the preview when there is no dismissal or the url changed', () => {
    expect(shouldShowComposerLinkPreview('https://example.com/post', null)).toBe(true);
    expect(
      shouldShowComposerLinkPreview(
        'https://example.com/next',
        'https://example.com/post',
      ),
    ).toBe(true);
  });
});
