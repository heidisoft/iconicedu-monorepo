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

  it('does not include reports when the flag is off', () => {
    const sections = buildAdminMenuSections('/iconic-academy', {
      includeReports: false,
    });

    expect(sections.map((section) => section.title)).not.toContain('Reports');
  });

  it('does not include activity feed audit when the flag is off', () => {
    const sections = buildAdminMenuSections('/iconic-academy', {
      includeActivityFeedAudit: false,
    });
    const activitySection = sections.find((section) => section.title === 'Activity');

    expect(activitySection?.links.map((link) => link.title)).not.toContain(
      'Activity feed',
    );
    expect(activitySection?.links.map((link) => link.title)).toContain('Activity logs');
  });

  it('includes reports by default', () => {
    const sections = buildAdminMenuSections('/iconic-academy');

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Reports',
          links: [
            { title: 'Overview', url: '/iconic-academy/admin/reports' },
            { title: 'Users', url: '/iconic-academy/admin/reports/users' },
            {
              title: 'Classrooms & sessions',
              url: '/iconic-academy/admin/reports/classrooms',
            },
            { title: 'Channels', url: '/iconic-academy/admin/reports/channels' },
            { title: 'Activity', url: '/iconic-academy/admin/reports/activity' },
          ],
        }),
      ]),
    );
  });

  it('places reports immediately before settings', () => {
    const titles = buildAdminMenuSections('/iconic-academy').map(
      (section) => section.title,
    );

    expect(titles.indexOf('Reports')).toBe(titles.indexOf('Settings') - 1);
  });
});
