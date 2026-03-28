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
});
