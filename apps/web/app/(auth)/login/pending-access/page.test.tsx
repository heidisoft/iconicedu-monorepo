import React from 'react';
import { render, screen } from '@testing-library/react';

import PendingAccessPage, {
  metadata,
} from '@iconicedu/web/app/(auth)/login/pending-access/page';

describe('pending access page', () => {
  it('renders pending review copy', () => {
    render(<PendingAccessPage />);
    expect(screen.getByRole('heading', { name: 'Access request received' })).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
  });

  it('defines noindex metadata', () => {
    expect(metadata.title).toBe('Access Pending | ICONIC Academy');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
