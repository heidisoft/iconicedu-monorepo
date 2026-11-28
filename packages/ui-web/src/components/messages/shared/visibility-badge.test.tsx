/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { getVisibilityCopy, VisibilityBadge } from './visibility-badge';

const messagesState = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('@iconicedu/ui-web/components/messages/context/messages-state-provider', () => ({
  useOptionalMessagesState: () => messagesState.current,
}));

describe('getVisibilityCopy', () => {
  const names = new Map([
    ['profile-me', 'Alex'],
    ['profile-1', 'Marc F'],
  ]);

  it('summarizes selected people relative to the viewer', () => {
    expect(
      getVisibilityCopy(
        {
          type: 'specific-users',
          userIds: ['profile-me', 'profile-1'],
        },
        names,
        'profile-me',
      ),
    ).toEqual({
      summary: 'Only visible to you + 1 other',
      names: ['You', 'Marc F'],
    });
  });
});

describe('audience copy edge cases', () => {
  const names = new Map([
    ['me', 'Alex'],
    ['other', 'Taylor'],
  ]);
  const copy = (visibility: Parameters<typeof getVisibilityCopy>[0]) =>
    getVisibilityCopy(visibility, names, 'me');
  it('does not show a private badge for everyone', () => {
    expect(copy({ type: 'all' })).toBeNull();
  });
  it('handles sender-only and recipient-only messages', () => {
    expect(copy({ type: 'sender-only' })?.summary).toBe('Only visible to you');
    expect(copy({ type: 'recipient-only', userId: 'me' })?.summary).toBe(
      'Only visible to you',
    );
    expect(copy({ type: 'recipient-only', userId: 'other' })?.summary).toBe(
      'Only visible to Taylor',
    );
  });
  it('deduplicates people and uses singular other', () => {
    expect(
      copy({ type: 'specific-users', userIds: ['me', 'other', 'other'] })?.summary,
    ).toBe('Only visible to you + 1 other');
    expect(copy({ type: 'specific-users', userIds: ['me'] })?.summary).toBe(
      'Only visible to you',
    );
  });
  it('does not expose profile identifiers for unknown members', () => {
    const value = copy({ type: 'specific-users', userIds: ['unknown-id'] });
    expect(JSON.stringify(value)).not.toContain('unknown-id');
    expect(value?.summary).toBe('Only visible to Channel member');
  });
});

describe('audience copy for viewers outside the audience', () => {
  const names = new Map([
    ['p1', 'Marc F'],
    ['p2', 'Taylor R'],
    ['p3', 'Jordan K'],
  ]);

  it('names the first person and counts the rest', () => {
    expect(
      getVisibilityCopy(
        { type: 'specific-users', userIds: ['p1', 'p2', 'p3'] },
        names,
        'staff',
      ),
    ).toEqual({
      summary: 'Only visible to Marc F + 2 others',
      names: ['Marc F', 'Taylor R', 'Jordan K'],
    });
  });

  it('deduplicates before counting', () => {
    expect(
      getVisibilityCopy({ type: 'specific-users', userIds: ['p1', 'p1'] }, names, 'staff')
        ?.summary,
    ).toBe('Only visible to Marc F');
  });

  it('falls back to neutral labels when participants are not loaded', () => {
    expect(
      getVisibilityCopy({ type: 'specific-users', userIds: ['p1', 'p2'] }, new Map()),
    ).toEqual({
      summary: 'Only visible to Channel member + 1 other',
      names: ['Channel member', 'Channel member'],
    });
    expect(
      getVisibilityCopy({ type: 'recipient-only', userId: 'p9' }, new Map()),
    ).toEqual({
      summary: 'Only visible to recipient',
      names: ['Recipient'],
    });
  });

  it('does not say "you" when the viewer is unknown', () => {
    expect(
      getVisibilityCopy({ type: 'recipient-only', userId: 'p1' }, names)?.summary,
    ).toBe('Only visible to Marc F');
  });
});

describe('VisibilityBadge', () => {
  const message = (visibility: MessageVM['core']['visibility']) =>
    ({ core: { visibility } }) as unknown as MessageVM;

  beforeEach(() => {
    messagesState.current = {
      currentUserId: 'me',
      channel: {
        collections: {
          participants: [
            { ids: { id: 'me' }, profile: { displayName: 'Alex' } },
            { ids: { id: 'p1' }, profile: { displayName: 'Marc F' } },
            { ids: { id: 'p2' }, profile: { displayName: 'Taylor R' } },
          ],
        },
      },
    };
  });

  it('renders nothing for messages visible to everyone', () => {
    const { container } = render(<VisibilityBadge message={message({ type: 'all' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a compact summary and lists the full audience on demand', () => {
    render(
      <VisibilityBadge
        message={message({ type: 'specific-users', userIds: ['me', 'p1', 'p2'] })}
      />,
    );

    const trigger = screen.getByTestId('message-visibility-badge');
    expect(trigger).toHaveAccessibleName('Only visible to you + 2 others. Show audience');
    expect(screen.queryByText('Visible to')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByText('Visible to')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['You', 'Marc F', 'Taylor R']);
  });

  it('tells staff reviewers the message is read-only', () => {
    messagesState.current = {
      ...(messagesState.current as object),
      currentUserId: 'staff-1',
    };
    render(
      <VisibilityBadge
        message={
          {
            core: {
              visibility: { type: 'specific-users', userIds: ['p1', 'p2'] },
              sender: { ids: { id: 'p1' } },
            },
          } as unknown as MessageVM
        }
      />,
    );
    fireEvent.click(screen.getByTestId('message-visibility-badge'));
    expect(screen.getByText('Staff view · you can read this but not reply')).toBeTruthy();
  });

  it('does not show the staff note to audience members', () => {
    render(
      <VisibilityBadge
        message={
          {
            core: {
              visibility: { type: 'specific-users', userIds: ['me', 'p1'] },
              sender: { ids: { id: 'p1' } },
            },
          } as unknown as MessageVM
        }
      />,
    );
    fireEvent.click(screen.getByTestId('message-visibility-badge'));
    expect(screen.queryByText(/Staff view/)).toBeNull();
  });

  it('works without a messages state provider', () => {
    messagesState.current = undefined;
    render(
      <VisibilityBadge message={message({ type: 'specific-users', userIds: ['p1'] })} />,
    );
    expect(screen.getByTestId('message-visibility-badge')).toHaveAccessibleName(
      'Only visible to Channel member. Show audience',
    );
  });
});
