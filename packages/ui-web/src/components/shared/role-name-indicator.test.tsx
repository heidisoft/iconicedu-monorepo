import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { RoleNameIndicator } from './role-name-indicator';

describe('RoleNameIndicator', () => {
  it('renders a staff indicator with tooltip for staff names', async () => {
    const user = userEvent.setup();

    render(<RoleNameIndicator name="ICONIC Support" role="staff" />);

    const trigger = screen.getByLabelText('Staff member');
    expect(screen.getByTestId('staff-name-indicator')).toBeInTheDocument();

    await user.hover(trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Staff member');
  });

  it('does not render the staff indicator for non-staff roles', () => {
    render(<RoleNameIndicator name="Priya Patel" role="educator" />);

    expect(screen.queryByTestId('staff-name-indicator')).not.toBeInTheDocument();
  });
});
