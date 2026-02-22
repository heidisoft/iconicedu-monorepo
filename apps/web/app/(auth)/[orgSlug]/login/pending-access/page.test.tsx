import React from 'react';

import PendingAccessPage, {
  metadata,
} from '@iconicedu/web/app/(auth)/[orgSlug]/login/pending-access/page';

describe('pending access page', () => {
  it('exports a page component', () => {
    expect(typeof PendingAccessPage).toBe('function');
  });

  it('defines noindex metadata', () => {
    expect(metadata.title).toBe('Access Pending | ICONIC Academy');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
