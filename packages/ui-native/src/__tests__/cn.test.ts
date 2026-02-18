import { cn } from '../lib/utils';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('handles empty call', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('merges conditional classes', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe(
      'base active',
    );
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});
