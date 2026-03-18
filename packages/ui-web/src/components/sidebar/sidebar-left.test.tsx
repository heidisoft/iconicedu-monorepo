import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

import { SidebarLeft } from '@iconicedu/ui-web/components/sidebar/sidebar-left';
import { SidebarProvider } from '@iconicedu/ui-web/ui/sidebar';

vi.mock('@iconicedu/ui-web/ui/sidebar', () => {
  const React = require('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('div', props, children);
  return {
    SidebarProvider: passthrough,
    Sidebar: passthrough,
    SidebarContent: passthrough,
    SidebarFooter: passthrough,
    SidebarGroup: passthrough,
    SidebarGroupAction: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
    SidebarGroupContent: passthrough,
    SidebarGroupLabel: passthrough,
    SidebarHeader: passthrough,
    SidebarMenu: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('ul', props, children),
    SidebarMenuButton: ({
      children,
      asChild,
      ...props
    }: {
      children?: React.ReactNode;
      asChild?: boolean;
    }) => (asChild ? children : React.createElement('button', props, children)),
    SidebarMenuItem: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('li', props, children),
    SidebarMenuAction: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
    SidebarSeparator: passthrough,
    useSidebar: () => ({ isMobile: false, state: 'expanded' }),
  };
});

function makeData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'educator',
        ids: {
          id: 'profile-educator',
          orgId: 'org-1',
          accountId: 'account-educator',
        },
        profile: {
          displayName: 'Educator One',
          firstName: 'Educator',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'educator' },
        },
        prefs: {},
        meta: {},
      },
      account: { id: 'account-educator', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-1', orgId: 'org-1' },
          basics: { title: 'Algebra 1', subject: 'Math', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-1', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 2 },
                participants: [
                  {
                    kind: 'educator',
                    ids: { id: 'profile-educator', accountId: 'account-educator' },
                  },
                ],
              },
            },
          },
        },
        {
          ids: { id: 'space-2', orgId: 'org-1' },
          basics: { title: 'Chemistry', subject: 'Science', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-2', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 5 },
                participants: [{ ids: { accountId: 'account-other' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as unknown as SidebarLeftDataVM;
}

function makeGuardianData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'guardian',
        ids: {
          id: 'profile-guardian',
          orgId: 'org-1',
          accountId: 'account-guardian',
        },
        profile: {
          displayName: 'Parent One',
          firstName: 'Parent',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'parent' },
        },
        prefs: {},
        meta: {},
        children: {
          items: [
            {
              ids: {
                id: 'profile-child-1',
                orgId: 'org-1',
                accountId: 'account-child-1',
              },
              profile: {
                displayName: 'Aiden One',
                firstName: 'Aiden',
                lastName: 'One',
                avatar: { source: 'seed', seed: 'child-1' },
              },
              ui: {},
            },
            {
              ids: {
                id: 'profile-child-2',
                orgId: 'org-1',
                accountId: 'account-child-2',
              },
              profile: {
                displayName: 'Bella Two',
                firstName: 'Bella',
                lastName: 'Two',
                avatar: { source: 'seed', seed: 'child-2' },
              },
              ui: {},
            },
          ],
        },
      },
      account: { id: 'account-guardian', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-child-1', orgId: 'org-1' },
          basics: { title: 'Reading', subject: 'English', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-child-1', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 1 },
                participants: [{ ids: { accountId: 'account-child-1' } }],
              },
            },
          },
        },
        {
          ids: { id: 'space-child-2', orgId: 'org-1' },
          basics: { title: 'Math Club', subject: 'Math', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-child-2', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 3 },
                participants: [{ ids: { accountId: 'account-child-2' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as unknown as SidebarLeftDataVM;
}

function makeGuardianSupervisedDmData() {
  return {
    ...makeGuardianData(),
    collections: {
      ...makeGuardianData().collections,
      directMessages: [
        {
          ids: { id: 'dm-guardian', orgId: 'org-1' },
          basics: { topic: 'Guardian DM' },
          collections: {
            readState: { unreadCount: 0 },
            messages: { items: [] },
            participants: [
              {
                ids: { id: 'profile-guardian', accountId: 'account-guardian' },
                profile: { displayName: 'Parent One' },
              },
              {
                ids: { id: 'profile-teacher', accountId: 'account-teacher' },
                profile: { displayName: 'Teacher One' },
              },
            ],
          },
        },
        {
          ids: { id: 'dm-child-1', orgId: 'org-1' },
          basics: { topic: 'Child DM 1' },
          collections: {
            readState: { unreadCount: 2 },
            messages: { items: [] },
            participants: [
              {
                ids: { id: 'profile-child-1', accountId: 'account-child-1' },
                profile: { displayName: 'Child One' },
              },
              {
                ids: { id: 'profile-other-1', accountId: 'account-other-1' },
                profile: { displayName: 'Mentor One' },
              },
            ],
          },
        },
        {
          ids: { id: 'dm-child-2', orgId: 'org-1' },
          basics: { topic: 'Child DM 2' },
          collections: {
            readState: { unreadCount: 1 },
            messages: { items: [] },
            participants: [
              {
                ids: { id: 'profile-child-2', accountId: 'account-child-2' },
                profile: { displayName: 'Child Two' },
              },
              {
                ids: { id: 'profile-other-2', accountId: 'account-other-2' },
                profile: { displayName: 'Tutor Two' },
              },
            ],
          },
        },
      ],
    },
  } as unknown as SidebarLeftDataVM;
}

function makeStudentData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'child',
        ids: {
          id: 'profile-student',
          orgId: 'org-1',
          accountId: 'account-student',
        },
        profile: {
          displayName: 'Student One',
          firstName: 'Student',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'student' },
        },
        prefs: {},
        meta: {},
      },
      account: { id: 'account-student', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-student-1', orgId: 'org-1' },
          basics: { title: 'Student Algebra', subject: 'Math', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-student-1', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 2 },
                participants: [
                  {
                    kind: 'child',
                    ids: { id: 'profile-student', accountId: 'account-student' },
                  },
                ],
              },
            },
          },
        },
        {
          ids: { id: 'space-student-2', orgId: 'org-1' },
          basics: { title: 'Other Space', subject: 'Science', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-student-2', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 4 },
                participants: [{ ids: { accountId: 'account-other' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as unknown as SidebarLeftDataVM;
}

function makeEducatorWithoutLearningSpacesData() {
  return {
    navigation: {
      navMain: [{ title: 'Home', url: '/d', icon: 'home' }],
      navSecondary: [],
    },
    user: {
      profile: {
        kind: 'educator',
        ids: {
          id: 'profile-educator',
          orgId: 'org-1',
          accountId: 'account-educator',
        },
        profile: {
          displayName: 'Educator One',
          firstName: 'Educator',
          lastName: 'One',
          avatar: { source: 'seed', seed: 'educator' },
        },
        prefs: {},
        meta: {},
      },
      account: { id: 'account-educator', orgId: 'org-1', contacts: {} },
    },
    collections: {
      learningSpaces: [
        {
          ids: { id: 'space-other', orgId: 'org-1' },
          basics: { title: 'Other Space', subject: 'Science', iconKey: null },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-other', orgId: 'org-1' },
              basics: { iconKey: null },
              ui: {},
              collections: {
                readState: { unreadCount: 0 },
                participants: [{ ids: { accountId: 'account-other' } }],
              },
            },
          },
        },
      ],
      directMessages: [],
    },
  } as unknown as SidebarLeftDataVM;
}

describe('SidebarLeft', () => {
  it('shows an organization switcher below the header when user belongs to multiple orgs', () => {
    const data = makeData();
    data.organizations = [
      {
        id: 'org-1',
        name: 'ICONIC Academy',
        slug: 'iconic-academy',
        url: '/iconic-academy',
        isCurrent: true,
      },
      {
        id: 'org-2',
        name: 'Second Campus',
        slug: 'second-campus',
        url: '/second-campus',
        isCurrent: false,
      },
    ];

    render(
      <SidebarProvider>
        <SidebarLeft data={data} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Organization')).toBeInTheDocument();
    const trigger = screen
      .getAllByRole('button', { name: /ICONIC Academy/i })
      .find((button) => button.getAttribute('aria-haspopup') === 'menu');
    expect(trigger).toBeTruthy();
  });

  it('shows educator classes on the sidebar', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Classrooms')).toBeInTheDocument();
    expect(screen.getByText('Algebra 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Algebra 1/i })).toHaveAttribute(
      'href',
      '//spaces/channel-1',
    );
    expect(screen.queryByText('Chemistry')).not.toBeInTheDocument();
    expect(screen.queryByText('Educator')).not.toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Direct Messages')).not.toBeInTheDocument();
  });

  it('shows only educator classrooms for tutor persona on shared account', () => {
    const data = makeData();
    data.user.profile.kind = 'educator';
    data.user.profile.ids = {
      id: 'profile-educator',
      orgId: 'org-1',
      accountId: 'account-shared',
    };
    data.collections.learningSpaces = [
      {
        ids: { id: 'space-parent', orgId: 'org-1' },
        basics: { title: 'Parent Room', subject: 'Reading', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-parent', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              readState: { unreadCount: 1 },
              participants: [
                {
                  kind: 'guardian',
                  ids: { id: 'profile-guardian', accountId: 'account-shared' },
                },
              ],
            },
          },
        },
      },
      {
        ids: { id: 'space-tutor', orgId: 'org-1' },
        basics: { title: 'Tutor Room', subject: 'Math', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-tutor', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              readState: { unreadCount: 2 },
              participants: [
                {
                  kind: 'educator',
                  ids: { id: 'profile-educator', accountId: 'account-shared' },
                },
              ],
            },
          },
        },
      },
    ];

    render(
      <SidebarProvider>
        <SidebarLeft data={data} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Tutor Room')).toBeInTheDocument();
    expect(screen.queryByText('Parent Room')).not.toBeInTheDocument();
  });

  it('renders slug-based links when active path is org scoped', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeData()} activePath="/iconic-academy/spaces/channel-1" />
      </SidebarProvider>,
    );

    expect(screen.getByRole('link', { name: /Algebra 1/i })).toHaveAttribute(
      'href',
      '/iconic-academy/spaces/channel-1',
    );
  });

  it('keeps all parent classes expanded', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeGuardianData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('Math Club')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows educator learning-space unread when participant accountId is missing', () => {
    const data = makeData();
    data.collections.learningSpaces = [
      {
        ids: { id: 'space-1', orgId: 'org-1' },
        basics: { title: 'Physics', subject: 'Science', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-physics', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              participants: [{ ids: { id: 'profile-educator' } }],
              readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
              messages: {
                items: [
                  {
                    core: {
                      sender: { ids: { accountId: 'account-other' } },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];

    render(
      <SidebarProvider>
        <SidebarLeft data={data} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Physics/i })).toHaveAttribute(
      'href',
      '//spaces/channel-physics',
    );
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });

  it('shows student classes with section header when assigned spaces exist', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeStudentData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Classrooms')).toBeInTheDocument();
    expect(screen.getByText('Student Algebra')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Student Algebra/i })).toHaveAttribute(
      'href',
      '//spaces/channel-student-1',
    );
    expect(screen.queryByText('Other Space')).not.toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
  });

  it('shows only child classrooms for student persona on shared account', () => {
    const data = makeStudentData();
    data.user.profile.ids = {
      id: 'profile-student',
      orgId: 'org-1',
      accountId: 'account-shared-student',
    };
    data.collections.learningSpaces = [
      {
        ids: { id: 'space-guardian-view', orgId: 'org-1' },
        basics: { title: 'Guardian View Space', subject: 'Reading', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-guardian-view', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              readState: { unreadCount: 1 },
              participants: [
                {
                  kind: 'guardian',
                  ids: { id: 'profile-parent', accountId: 'account-shared-student' },
                },
              ],
            },
          },
        },
      },
      {
        ids: { id: 'space-student-view', orgId: 'org-1' },
        basics: { title: 'Student View Space', subject: 'Math', iconKey: null },
        channels: {
          primaryChannel: {
            ids: { id: 'channel-student-view', orgId: 'org-1' },
            basics: { iconKey: null },
            ui: {},
            collections: {
              readState: { unreadCount: 2 },
              participants: [
                {
                  kind: 'child',
                  ids: {
                    id: 'profile-student',
                    accountId: 'account-shared-student',
                  },
                },
              ],
            },
          },
        },
      },
    ];

    render(
      <SidebarProvider>
        <SidebarLeft data={data} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Student View Space')).toBeInTheDocument();
    expect(screen.queryByText('Guardian View Space')).not.toBeInTheDocument();
  });

  it('hides classes for educators without assigned spaces', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeEducatorWithoutLearningSpacesData()} />
      </SidebarProvider>,
    );

    expect(screen.queryByText('Classrooms')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Space')).not.toBeInTheDocument();
  });

  it('shows supervised direct messages for guardian grouped by child', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeGuardianSupervisedDmData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Supervised DMs')).toBeInTheDocument();
    expect(screen.getByText('Mentor One')).toBeInTheDocument();
    expect(screen.getByText('Tutor Two')).toBeInTheDocument();
    const sectionHeader = screen.getByText('Supervised DMs').closest('div');
    expect(sectionHeader).not.toBeNull();
    expect(within(sectionHeader as HTMLElement).queryByText('3')).not.toBeInTheDocument();
  });

  it('toggles parent classes groups', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeGuardianData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Reading')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Aiden'));
    expect(screen.queryByText('Reading')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Aiden'));
    expect(screen.getByText('Reading')).toBeInTheDocument();
  });

  it('toggles parent supervised dm groups', () => {
    render(
      <SidebarProvider>
        <SidebarLeft data={makeGuardianSupervisedDmData()} />
      </SidebarProvider>,
    );

    expect(screen.getByText('Mentor One')).toBeInTheDocument();
    const aidenLabels = screen.getAllByText('Aiden');
    fireEvent.click(aidenLabels[1]);
    expect(screen.queryByText('Mentor One')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Aiden')[1]);
    expect(screen.getByText('Mentor One')).toBeInTheDocument();
  });
});
