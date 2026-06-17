import {
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
});
