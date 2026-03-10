/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { getLearningSpaceMetadata } from './learning-space-info-panel';

describe('learning-space-info-panel metadata', () => {
  it('builds learning-space metadata rows', () => {
    const metadata = getLearningSpaceMetadata(
      {
        basics: {
          title: 'Algebra',
          status: 'active',
          kind: 'small_group',
        },
        participants: [{}, {}],
      } as any,
      {
        basics: {
          visibility: 'private',
          purpose: 'general',
        },
      } as any,
      'Jan 1, 2026, 10:00 AM',
    );

    expect(metadata.map((row) => row.label)).toEqual([
      'Created',
      'Status',
      'Kind',
      'Visibility',
      'Purpose',
      'Participants',
    ]);
    expect(metadata.find((row) => row.label === 'Participants')?.value).toBe('2');
  });
});
