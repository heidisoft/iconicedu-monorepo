/* @vitest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeFunctionsDashboard } from './edge-functions-dashboard';
const { dispatch, success, error } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/api/admin-tools', () => ({ dispatchAdminTool: dispatch }));
vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}));
vi.mock('@iconicedu/ui-web', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Button: ({ children, onClick, disabled }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Label: (props: React.ComponentProps<'label'>) => <label {...props} />,
  Loader2: () => <span>Loading</span>,
  toast: { success, error },
}));
describe('Admin background job tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatch.mockResolvedValue({
      success: true,
      status: 200,
      data: { result: { claimed: 3, succeeded: 3 } },
    });
  });
  afterEach(cleanup);
  it.each([
    ['Session Completion Checks', 'session-completions-dispatch'],
    ['Push Notifications', 'push-notifications-dispatch'],
    ['Schedule Reconciliation', 'schedule-reconciliation-dispatch'],
  ])('runs %s independently for the selected organization', async (title, kind) => {
    render(<EdgeFunctionsDashboard orgId="org-1" />);
    const card = screen.getByRole('heading', { name: title }).parentElement!
      .parentElement!;
    fireEvent.change(within(card).getByLabelText('Limit'), { target: { value: '7' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Run now' }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(expect.anything(), {
        orgId: 'org-1',
        kind,
        limit: 7,
      }),
    );
    await waitFor(() => expect(success).toHaveBeenCalledWith(`${title} completed`));
  });
  it('shows job failures even when the API request itself succeeds', async () => {
    dispatch.mockResolvedValue({
      success: false,
      status: 200,
      message: 'Run completed with job failures.',
      data: { result: { claimed: 3, failed: 2 } },
    });
    render(<EdgeFunctionsDashboard orgId="org-1" />);
    const card = screen.getByRole('heading', { name: 'Session Completion Checks' })
      .parentElement!.parentElement!;
    fireEvent.click(within(card).getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(success).not.toHaveBeenCalled();
    expect(within(card).getByText('Error')).toBeTruthy();
    expect(within(card).getByText(/"failed": 2/)).toBeTruthy();
  });
});
