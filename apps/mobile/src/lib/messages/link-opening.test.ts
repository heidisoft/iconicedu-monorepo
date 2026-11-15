import {
  findFirstMessageLink,
  isTrustedExternalLink,
  splitMessageTextByLinks,
} from '@/lib/messages/link-opening';

describe('message link opening helpers', () => {
  it('splits plain message text into text and link parts', () => {
    expect(splitMessageTextByLinks('See https://example.com/a.')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', value: 'https://example.com/a', url: 'https://example.com/a' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('normalizes www links', () => {
    expect(splitMessageTextByLinks('Visit www.example.com')).toEqual([
      { kind: 'text', value: 'Visit ' },
      { kind: 'link', value: 'www.example.com', url: 'https://www.example.com' },
    ]);
  });

  it('trusts IconicEdu and app store links', () => {
    expect(isTrustedExternalLink('https://iconicedu.com')).toBe(true);
    expect(isTrustedExternalLink('https://www.iconicedu.com/help')).toBe(true);
    expect(isTrustedExternalLink('https://apps.apple.com/us/app/iconicedu')).toBe(true);
    expect(
      isTrustedExternalLink('https://play.google.com/store/apps/details?id=app'),
    ).toBe(true);
    expect(isTrustedExternalLink('https://example.com')).toBe(false);
  });

  it('finds the first URL in a composer draft for link preview detection', () => {
    expect(findFirstMessageLink('Check out https://example.com/a and more')).toBe(
      'https://example.com/a',
    );
    expect(findFirstMessageLink('www.example.com is neat')).toBe(
      'https://www.example.com',
    );
  });

  it('returns null when the draft has no URL', () => {
    expect(findFirstMessageLink('just some plain text')).toBeNull();
  });

  it('returns only the first URL when multiple are present', () => {
    expect(findFirstMessageLink('https://first.com then https://second.com')).toBe(
      'https://first.com',
    );
  });
});
