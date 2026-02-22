import React from 'react';
import { render, screen } from '@testing-library/react';

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
