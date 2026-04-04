/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildAboutFields, ProfileContent } from './profile-sheet';

const makeUser = () =>
  ({
    kind: 'educator',
    ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    profile: {
      displayName: 'Sara Parras',
      avatar: { url: null, source: 'seed' },
    },
    prefs: {},
    meta: {},
    presence: {
      liveStatus: 'online',
      displayStatus: 'online',
      state: {},
    },
  }) as any;

describe('ProfileContent', () => {
  it('hides online status indicator in profile info avatar', () => {
    render(<ProfileContent user={makeUser()} />);
    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument();
  });

  it('does not render quick actions or media files sections', () => {
    render(<ProfileContent user={makeUser()} />);
    expect(screen.queryByText('Quick actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Media & files')).not.toBeInTheDocument();
  });

  it('renders a Message quick action when a DM handler is provided', () => {
    const onDmClick = vi.fn();
    render(<ProfileContent user={makeUser()} onDmClick={onDmClick} />);

    const messageButton = screen.getByRole('button', { name: 'Message' });
    fireEvent.click(messageButton);

    expect(onDmClick).toHaveBeenCalledTimes(1);
  });

  it('builds public profile metadata fields when available', () => {
    const aboutFields = buildAboutFields({
      ...makeUser(),
      profile: {
        ...makeUser().profile,
        email: 'iconicedudev+sara@gmail.com',
        bio: 'Math educator',
      },
      headline: 'Senior tutor',
      subjects: ['Math', 'Science'],
      prefs: {
        timezone: 'America/New_York',
        languagesSpoken: ['English', 'Spanish'],
      },
      location: {
        city: 'New York',
        region: 'NY',
        countryName: 'United States',
      },
    });

    expect(aboutFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Headline', value: 'Senior tutor' }),
        expect.objectContaining({ label: 'Role', value: 'Teacher' }),
        expect.objectContaining({ label: 'Email', value: 'iconicedudev+sara@gmail.com' }),
        expect.objectContaining({
          label: 'Location',
          value: 'New York, NY, United States',
        }),
        expect.objectContaining({ label: 'Timezone', value: 'America/New_York' }),
        expect.objectContaining({ label: 'Languages', value: 'English, Spanish' }),
      ]),
    );
  });

  it('builds child-specific and guardian-specific fields by role', () => {
    const childFields = buildAboutFields({
      ...makeUser(),
      kind: 'child',
      gradeLevel: 'grade_6',
      schoolName: 'Iconic Academy',
      schoolYear: '2026',
      guardianNames: ['Maya Parras'],
      interests: ['Math Club'],
      strengths: ['Problem Solving'],
      learningPreferences: ['Visual'],
      prefs: {},
    } as any);

    expect(childFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Role', value: 'Student' }),
        expect.objectContaining({ label: 'Grade', value: 'Grade 6' }),
        expect.objectContaining({ label: 'School', value: 'Iconic Academy' }),
        expect.objectContaining({ label: 'Parents', value: 'Maya Parras' }),
        expect.objectContaining({ label: 'Interests', value: 'Math Club' }),
      ]),
    );

    const guardianFields = buildAboutFields({
      ...makeUser(),
      kind: 'guardian',
      children: {
        items: [
          {
            profile: { displayName: 'Ava Parras', avatar: { source: 'seed', url: null } },
          },
          {
            profile: {
              displayName: 'Noah Parras',
              avatar: { source: 'seed', url: null },
            },
          },
        ],
      },
      joinedDate: '2025-01-10T00:00:00.000Z',
      prefs: {},
    } as any);

    expect(guardianFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Role', value: 'Parent' }),
        expect.objectContaining({ label: 'Children', value: 'Ava Parras, Noah Parras' }),
      ]),
    );
  });
});
