import { describe, expect, it } from 'vitest';
import { hashToTabKey, tabKeyToHash } from './messages-container-tab-hash';

describe('messages-container-tab-hash', () => {
  it('maps tab keys to expected hash labels', () => {
    expect(tabKeyToHash('messages')).toBe('messages');
    expect(tabKeyToHash('files')).toBe('files');
    expect(tabKeyToHash('schedule')).toBe('sessions');
    expect(tabKeyToHash('saved')).toBe('saved');
    expect(tabKeyToHash('members')).toBe('members');
  });

  it('maps hash values to tab keys', () => {
    expect(hashToTabKey('#messages')).toBe('messages');
    expect(hashToTabKey('#files')).toBe('files');
    expect(hashToTabKey('#sessions')).toBe('schedule');
    expect(hashToTabKey('#saved')).toBe('saved');
    expect(hashToTabKey('#members')).toBe('members');
  });

  it('returns null for invalid hash values', () => {
    expect(hashToTabKey('')).toBeNull();
    expect(hashToTabKey('#unknown')).toBeNull();
  });
});
