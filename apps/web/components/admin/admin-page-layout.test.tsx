import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';

vi.mock('@iconicedu/ui-web', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@iconicedu/ui-web')>();
  return {
    ...actual,
    DashboardHeader: ({ title }: { title: string }) => <div>{title}</div>,
  };
});

describe('admin page layout', () => {
  it('renders the shared dashboard frame and content region', () => {
    render(
      <AdminPageShell title="Users">
        <p>Page content</p>
      </AdminPageShell>,
    );

    expect(screen.getByText('Page content').closest('main')).toHaveClass(
      'gap-6',
      'p-4',
      'sm:p-6',
      'lg:p-8',
    );
  });

  it('keeps heading actions separate from the title and description', () => {
    render(
      <AdminPageHeading
        title="Classrooms"
        description="Manage learning spaces."
        actions={<button type="button">Add classroom</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Classrooms' })).toBeVisible();
    expect(screen.getByText('Manage learning spaces.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add classroom' })).toBeVisible();
  });
});
