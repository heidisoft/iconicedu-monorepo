import { describe, expect, it } from 'vitest';

import { extractComposerLinkPreviewUrl } from './message-input-link-preview.utils';

describe('extractComposerLinkPreviewUrl', () => {
  it('returns the first url in composer text', () => {
    expect(
      extractComposerLinkPreviewUrl('Check this https://example.com/post and respond'),
    ).toBe('https://example.com/post');
  });

  it('returns null when no url exists', () => {
    expect(extractComposerLinkPreviewUrl('No links here')).toBeNull();
  });
});
