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
});
