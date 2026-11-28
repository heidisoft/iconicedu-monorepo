import React from 'react';
import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RoleOnboardingModal } from '@iconicedu/web/app/(auth)/auth/callback/role-onboarding-modal';

describe('RoleOnboardingModal', () => {
  it('shows Parent, Student, Tutor options in order and hides Staff', () => {
    render(
      <RoleOnboardingModal
        open
        onSubmit={async () => ({
          success: true,
        })}
      />,
    );

    const options = screen.getAllByRole('radio');
    const labels = options.map((option) => option.textContent ?? '');

    expect(labels[0]).toContain('Parent');
    expect(labels[1]).toContain('Student');
    expect(labels[2]).toContain('Tutor');
    expect(screen.queryByText('Staff')).not.toBeInTheDocument();
  });
});

it('offers an optional referring-parent name only for parent onboarding when enabled', async () => {
  const submit = vi.fn(async (_input: unknown) => ({ success: true }));
  render(<RoleOnboardingModal open referralsEnabled onSubmit={submit} />);
  fireEvent.click(screen.getByRole('radio', { name: /Parent/ }));
  fireEvent.change(screen.getByLabelText('Who referred you? (optional)'), {
    target: { value: 'Test Parent' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'parent', referrerName: 'Test Parent' }),
    ),
  );
});
it('does not require a referral name and hides it when the flag is off', async () => {
  const submit = vi.fn(async (_input: unknown) => ({ success: true }));
  render(<RoleOnboardingModal open onSubmit={submit} />);
  fireEvent.click(screen.getByRole('radio', { name: /Parent/ }));
  expect(screen.queryByLabelText('Who referred you? (optional)')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0]![0]).not.toHaveProperty('referrerName');
});
it('shows an attached invitation without requiring typing and supports removing it', async () => {
  const submit = vi.fn(async (_input: unknown) => ({ success: true }));
  render(
    <RoleOnboardingModal
      open
      referralsEnabled
      linkedReferrerName="Test Parent"
      onSubmit={submit}
    />,
  );
  fireEvent.click(screen.getByRole('radio', { name: /Parent/ }));
  expect(screen.getByLabelText('Who referred you? (optional)')).toHaveValue(
    'Test Parent',
  );
  expect(screen.getByLabelText('Who referred you? (optional)')).toHaveAttribute(
    'readonly',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove referral' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'parent', skipReferral: true }),
    ),
  );
});
