import type { AdminMenuSectionVM } from '@iconicedu/shared-types';

export function buildAdminMenuSections(basePath: string): AdminMenuSectionVM[] {
  return [
    {
      title: 'Users',
      iconKey: 'users',
      links: [
        { title: 'All', url: `${basePath}/admin/users` },
        { title: 'Manage families', url: `${basePath}/admin/users/families` },
      ],
    },
    {
      title: 'Classrooms',
      iconKey: 'learning_spaces',
      links: [
        { title: 'All', url: `${basePath}/admin/spaces` },
        { title: 'Resources', url: `${basePath}/admin/spaces/resources` },
        { title: 'Session attendance', url: `${basePath}/admin/attendance/sessions` },
      ],
    },
    {
      title: 'Channels',
      iconKey: 'channels',
      links: [
        { title: 'All', url: `${basePath}/admin/channels` },
        { title: 'Direct messages', url: `${basePath}/admin/channels/direct-messages` },
      ],
    },
    {
      title: 'Activity',
      iconKey: 'activity',
      links: [
        { title: 'Activity feed', url: `${basePath}/admin/activity/feed` },
        { title: 'Activity logs', url: `${basePath}/admin/activity/logs` },
        {
          title: 'Inbox & notifications',
          url: `${basePath}/admin/activity/inbox`,
        },
      ],
    },
    {
      title: 'Moderation',
      iconKey: 'moderation',
      links: [
        { title: 'Flagged messages', url: `${basePath}/admin/moderation/flags` },
        { title: 'Participant reports', url: `${basePath}/admin/moderation/reports` },
      ],
    },
    {
      title: 'Settings',
      iconKey: 'system',
      links: [
        { title: 'Activity controls', url: `${basePath}/admin/settings/activity` },
        { title: 'Account settings', url: `${basePath}/admin/settings/accounts` },
        { title: 'Roles & policies', url: `${basePath}/admin/settings/roles` },
      ],
    },
  ];
}
