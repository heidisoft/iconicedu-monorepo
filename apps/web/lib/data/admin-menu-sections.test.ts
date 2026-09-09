import { describe, expect, it } from 'vitest';

import { buildAdminMenuSections } from '@iconicedu/web/lib/data/admin-menu-sections';

describe('buildAdminMenuSections', () => {
  it('does not include announcements or support in channels menu', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const channelsSection = sections.find((section) => section.title === 'Channels');
    expect(channelsSection).toBeDefined();
    const titles = (channelsSection?.links ?? []).map((link) => link.title);
    expect(titles).not.toContain('Announcements');
    expect(titles).not.toContain('Support');
  });

  it('includes activity controls under settings', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const settingsSection = sections.find((section) => section.title === 'Settings');
    expect(settingsSection?.links.map((link) => link.title)).toContain(
      'Activity controls',
    );
  });

  it('includes subjects under settings', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const settingsSection = sections.find((section) => section.title === 'Settings');
    expect(settingsSection?.links.map((link) => link.title)).toContain('Subjects');
  });

  it('includes admin tools under settings', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const settingsSection = sections.find((section) => section.title === 'Settings');

    expect(settingsSection?.links).toContainEqual({
      title: 'Tools',
      url: '/iconic-academy/admin/tools',
    });
  });

  it('links classrooms admin routes with the classrooms path', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const classroomsSection = sections.find((section) => section.title === 'Classrooms');

    expect(classroomsSection?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'All',
          url: '/iconic-academy/admin/classrooms',
        }),
      ]),
    );
  });

  it('lists the job activity overview and one link per background job', () => {
    const sections = buildAdminMenuSections('/iconic-academy');
    const activitySection = sections.find((section) => section.title === 'Activity');

    expect(activitySection?.links).toEqual(
      expect.arrayContaining([
        { title: 'Overview', url: '/iconic-academy/admin/activity' },
        {
          title: 'Activity source jobs',
          url: '/iconic-academy/admin/activity/activity-source',
        },
        {
          title: 'Event pipeline',
          url: '/iconic-academy/admin/activity/event-pipeline',
        },
        {
          title: 'Notification dispatch',
          url: '/iconic-academy/admin/activity/notification-dispatch',
        },
        { title: 'Reminders', url: '/iconic-academy/admin/activity/reminder' },
        {
          title: 'Schedule reconciliation',
          url: '/iconic-academy/admin/activity/reminder-reconcile',
        },
        {
          title: 'Session completions',
          url: '/iconic-academy/admin/activity/session-completion',
        },
      ]),
    );
  });

  it('no longer links the removed activity feed and push notification pages', () => {
    const urls = buildAdminMenuSections('/iconic-academy')
      .flatMap((section) => section.links)
      .map((link) => link.url);

    expect(urls).not.toContain('/iconic-academy/admin/activity/feed');
    expect(urls).not.toContain('/iconic-academy/admin/activity/notifications');
  });

  it('does not include reports', () => {
    const sections = buildAdminMenuSections('/iconic-academy');

    expect(sections.map((section) => section.title)).not.toContain('Reports');
  });

  it('labels the repurposed sessions page as completed sessions', () => {
    const link = buildAdminMenuSections('/iconic-academy')
      .flatMap((section) => section.links)
      .find((item) => item.url.endsWith('/admin/attendance/sessions'));

    expect(link?.title).toBe('Completed sessions');
  });

  it('only links to implemented admin pages', () => {
    const implementedAdminPaths = new Set([
      '/admin/activity',
      '/admin/activity/activity-source',
      '/admin/activity/event-pipeline',
      '/admin/activity/notification-dispatch',
      '/admin/activity/reminder',
      '/admin/activity/reminder-reconcile',
      '/admin/activity/session-completion',
      '/admin/attendance/sessions',
      '/admin/channels',
      '/admin/classrooms',
      '/admin/settings/activity',
      '/admin/settings/roles',
      '/admin/settings/subjects',
      '/admin/tools',
      '/admin/users',
      '/admin/users/families',
    ]);
    const links = buildAdminMenuSections('/iconic-academy').flatMap((section) =>
      section.links.map((link) => link.url.replace('/iconic-academy', '')),
    );

    expect(links).toEqual(expect.arrayContaining([...implementedAdminPaths]));
    expect(links).toHaveLength(implementedAdminPaths.size);
  });
});
