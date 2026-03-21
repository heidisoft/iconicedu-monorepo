import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { UserAccountVM, UserProfileVM } from '@iconicedu/shared-types';

import { NavUser } from './nav-user';

vi.mock('@iconicedu/ui-web/components/shared/avatar-with-status', () => ({
  AvatarWithStatus: () => <div data-testid="avatar">avatar</div>,
}));

vi.mock('@iconicedu/ui-web/ui/dropdown-menu', () => {
  const React = require('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => children,
    DropdownMenuContent: passthrough,
    DropdownMenuGroup: passthrough,
    DropdownMenuItem: ({
      children,
      onSelect,
      ...props
    }: {
      children?: React.ReactNode;
      onSelect?: (event: Event) => void;
    }) =>
      React.createElement(
        'button',
        {
          ...props,
          onClick: () => {
            if (onSelect) {
              onSelect({ preventDefault: () => undefined } as unknown as Event);
            }
          },
        },
        children,
      ),
    DropdownMenuLabel: passthrough,
    DropdownMenuSeparator: passthrough,
    DropdownMenuSub: passthrough,
    DropdownMenuSubTrigger: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
    DropdownMenuSubContent: passthrough,
  };
});

vi.mock('@iconicedu/ui-web/ui/button', () => ({
  Button: ({ children, ...props }: { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@iconicedu/ui-web/ui/dialog', () => {
  const React = require('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogFooter: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
  };
});

vi.mock('@iconicedu/ui-web/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@iconicedu/ui-web/ui/select', () => {
  const React = require('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    Select: passthrough,
    SelectContent: passthrough,
    SelectItem: passthrough,
    SelectTrigger: passthrough,
    SelectValue: passthrough,
  };
});

vi.mock('@iconicedu/ui-web/ui/sidebar', () => ({
  SidebarMenu: ({ children, ...props }: { children?: React.ReactNode }) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuButton: ({
    children,
    asChild,
    ...props
  }: {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? children : <button {...props}>{children}</button>),
  SidebarMenuItem: ({ children, ...props }: { children?: React.ReactNode }) => (
    <li {...props}>{children}</li>
  ),
}));

vi.mock('@iconicedu/ui-web/components/sidebar/user-settings-dialog', () => ({
  ONBOARDING_STEP_TO_TAB: {},
  UserSettingsDialog: () => null,
}));

vi.mock('@iconicedu/ui-web/components/sidebar/nav-user-status.utils', () => ({
  STATUS_CLEAR_AFTER_OPTIONS: [],
  STATUS_EMOJI_OPTIONS: [],
  STATUS_PRESETS: [],
  computeStatusExpiresAt: vi.fn(() => null),
}));

const profile: UserProfileVM = {
  kind: 'educator',
  ids: {
    id: 'profile-1',
    orgId: 'org-1',
    accountId: 'account-1',
  },
  profile: {
    displayName: 'Educator One',
    firstName: 'Educator',
    lastName: 'One',
    avatar: { source: 'seed', seed: 'educator' },
  },
  prefs: {
    locale: 'en-US',
    timezone: 'UTC',
  },
  meta: {},
  ui: {
    themeKey: 'teal',
  },
} as UserProfileVM;

const account: UserAccountVM = {
  ids: {
    id: 'account-1',
    orgId: 'org-1',
  },
  contacts: {
    email: 'educator@example.com',
  },
  lifecycle: {
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
};

describe('NavUser', () => {
  it('includes collapsed-state classes to center avatar and hide text affordances', () => {
    render(<NavUser profile={profile} account={account} />);

    const trigger = screen.getByRole('button', { name: /educator one/i });
    expect(trigger.className).toContain('group-data-[collapsible=icon]:justify-center');
    expect(trigger.className).toContain('group-data-[collapsible=icon]:px-0');

    expect(within(trigger).getByText('Educator One').parentElement?.className).toContain(
      'group-data-[collapsible=icon]:hidden',
    );

    const chevron = trigger.querySelector('svg');
    expect(chevron?.getAttribute('class')).toContain(
      'group-data-[collapsible=icon]:hidden',
    );
  });

  it('shows switching profile loading text while persona switch is pending', async () => {
    let resolveSwitch: (() => void) | null = null;
    const onPersonaSwitch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve;
        }),
    );

    render(
      <NavUser
        profile={profile}
        account={account}
        isPersonaSwitchEnabled
        availablePersonas={[
          { profileId: 'profile-1', kind: 'educator', label: 'Tutor', isActive: true },
          { profileId: 'profile-2', kind: 'guardian', label: 'Parent', isActive: false },
        ]}
        onPersonaSwitch={onPersonaSwitch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /switch profile/i }));
    fireEvent.click(screen.getByRole('button', { name: /parent/i }));

    expect(onPersonaSwitch).toHaveBeenCalledWith({ profileId: 'profile-2' });
    expect(screen.getByText('Switching profile...')).toBeInTheDocument();

    resolveSwitch?.();
    await waitFor(() => {
      expect(screen.queryByText('Switching profile...')).not.toBeInTheDocument();
    });
  });

  it('shows child view indicator and disables account menu when child has no auth account', () => {
    const childProfile: UserProfileVM = {
      kind: 'child',
      ids: {
        id: 'profile-child-1',
        orgId: 'org-1',
        accountId: 'account-child-1',
      },
      profile: {
        displayName: 'Aiden One',
        firstName: 'Aiden',
        lastName: 'One',
        avatar: { source: 'seed', seed: 'aiden' },
      },
      prefs: {
        locale: 'en-US',
        timezone: 'UTC',
      },
      meta: {},
      ui: {
        themeKey: 'teal',
      },
      accountAuthUserId: null,
    } as UserProfileVM;

    render(
      <NavUser
        profile={childProfile}
        account={account}
        isViewingAsChild
        viewingAsProfileId="profile-child-1"
        childHasAuthAccount={false}
      />,
    );

    expect(screen.getAllByText('Viewing as Aiden One').length).toBeGreaterThan(0);
    expect(screen.queryByText('educator@example.com')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Account (child login required)' }),
    ).toBeDisabled();
  });
});
