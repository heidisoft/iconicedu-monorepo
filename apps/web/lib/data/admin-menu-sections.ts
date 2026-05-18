import type { AdminMenuSectionVM } from '@iconicedu/shared-types';

export function buildAdminMenuSections(
  basePath: string,
  options: { includeActivityFeedAudit?: boolean; includeReports?: boolean } = {},
): AdminMenuSectionVM[] {
  const activityLinks = [
    ...(options.includeActivityFeedAudit === false
      ? []
      : [{ title: 'Activity feed', url: `${basePath}/admin/activity/feed` }]),
    { title: 'Activity logs', url: `${basePath}/admin/activity/logs` },
    {
      title: 'Inbox & notifications',
      url: `${basePath}/admin/activity/inbox`,
    },
  ];

  const sections: AdminMenuSectionVM[] = [
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
        { title: 'All', url: `${basePath}/admin/classrooms` },
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
      links: activityLinks,
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
      title: 'Reports',
      iconKey: 'reports',
      links: [
        { title: 'Overview', url: `${basePath}/admin/reports` },
        { title: 'Users', url: `${basePath}/admin/reports/users` },
        { title: 'Classrooms & sessions', url: `${basePath}/admin/reports/classrooms` },
        { title: 'Channels', url: `${basePath}/admin/reports/channels` },
        { title: 'Activity', url: `${basePath}/admin/reports/activity` },
      ],
    },
    {
      title: 'Settings',
      iconKey: 'system',
      links: [
        { title: 'Subjects', url: `${basePath}/admin/settings/subjects` },
        { title: 'Activity controls', url: `${basePath}/admin/settings/activity` },
        { title: 'Account settings', url: `${basePath}/admin/settings/accounts` },
        { title: 'Roles & policies', url: `${basePath}/admin/settings/roles` },
        { title: 'Tools', url: `${basePath}/admin/tools` },
      ],
    },
  ];

  return options.includeReports === false
    ? sections.filter((section) => section.title !== 'Reports')
    : sections;
}
