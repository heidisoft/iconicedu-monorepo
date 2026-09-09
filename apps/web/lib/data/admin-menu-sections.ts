import type { AdminMenuSectionVM } from '@iconicedu/shared-types';

export function buildAdminMenuSections(
  basePath: string,
  options: {
    includeReports?: boolean;
    includeAssessments?: boolean;
  } = {},
): AdminMenuSectionVM[] {
  const activityLinks = [
    { title: 'Overview', url: `${basePath}/admin/activity` },
    {
      title: 'Activity source jobs',
      url: `${basePath}/admin/activity/activity-source`,
    },
    { title: 'Event pipeline', url: `${basePath}/admin/activity/event-pipeline` },
    {
      title: 'Notification dispatch',
      url: `${basePath}/admin/activity/notification-dispatch`,
    },
    { title: 'Reminders', url: `${basePath}/admin/activity/reminder` },
    {
      title: 'Schedule reconciliation',
      url: `${basePath}/admin/activity/reminder-reconcile`,
    },
    {
      title: 'Session completions',
      url: `${basePath}/admin/activity/session-completion`,
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
        { title: 'Completed sessions', url: `${basePath}/admin/attendance/sessions` },
      ],
    },
    {
      title: 'Channels',
      iconKey: 'channels',
      links: [{ title: 'All', url: `${basePath}/admin/channels` }],
    },
    {
      title: 'Activity',
      iconKey: 'activity',
      links: activityLinks,
    },
    {
      title: 'Settings',
      iconKey: 'system',
      links: [
        { title: 'Subjects', url: `${basePath}/admin/settings/subjects` },
        { title: 'Activity controls', url: `${basePath}/admin/settings/activity` },
        { title: 'Roles & policies', url: `${basePath}/admin/settings/roles` },
        { title: 'Tools', url: `${basePath}/admin/tools` },
      ],
    },
  ];

  if (options.includeAssessments) {
    sections.splice(1, 0, {
      title: 'Assessments',
      iconKey: 'assessments',
      links: [
        { title: 'Overview', url: `${basePath}/admin/assessments` },
        { title: 'Curriculum', url: `${basePath}/admin/assessments/curriculum` },
        { title: 'Item Bank', url: `${basePath}/admin/assessments/items` },
        { title: 'Tests', url: `${basePath}/admin/assessments/tests` },
        { title: 'Deliveries', url: `${basePath}/admin/assessments/deliveries` },
      ],
    });
  }

  return options.includeReports === false
    ? sections.filter((section) => section.title !== 'Reports')
    : sections;
}
