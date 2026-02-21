import { metadata } from '@iconicedu/web/app/(app)/d/layout';

describe('dashboard layout metadata', () => {
  it('defines private dashboard metadata', () => {
    expect(metadata.description).toContain('dashboard');
    expect(metadata.robots).toEqual({ index: false, follow: false });

    const title = metadata.title as { default: string; template: string };
    expect(title.default).toBe('Dashboard | ICONIC Academy');
    expect(title.template).toBe('%s | ICONIC Academy Dashboard');
  });
});
