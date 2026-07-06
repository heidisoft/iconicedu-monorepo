import type { AdminMenuSectionVM } from '@iconicedu/shared-types';

export function buildAdminMenuSections(
  basePath: string,
  options: {
    includeReports?: boolean;
    includeAssessments?: boolean;
  } = {},
): AdminMenuSectionVM[] {
  const activityLinks = [
    { title: 'Activity feed', url: `${basePath}/admin/activity/feed` },
    {
      title: 'Push notifications',
      url: `${basePath}/admin/activity/notifications`,
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
        { title: 'Session changes', url: `${basePath}/admin/settings/session-changes` },
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
