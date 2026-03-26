import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { RoleAvatarBadge } from './role-avatar-badge';

describe('RoleAvatarBadge', () => {
  it('renders nothing for staff avatars', () => {
    render(<RoleAvatarBadge role="staff" />);

    expect(screen.queryByTestId('role-avatar-badge')).toBeNull();
  });

  it('renders nothing for admin-like avatars', () => {
    render(<RoleAvatarBadge role="admin" />);

    expect(screen.queryByTestId('role-avatar-badge')).toBeNull();
  });

  it('renders nothing for non-staff roles without a badge', () => {
    render(<RoleAvatarBadge role="guardian" />);

    expect(screen.queryByTestId('role-avatar-badge')).toBeNull();
  });
});
