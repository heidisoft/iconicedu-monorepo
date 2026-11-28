import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AccountInfoScreen from './account-info';
let mockRole = 'guardian';
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({
    data: {
      email: 'account@example.invalid',
      primary_role: mockRole,
      status: 'active',
      email_verified: true,
    },
  }),
}));
it.each(['guardian', 'child', 'educator', 'staff', 'admin', 'owner'])(
  'omits the Role/Status card for %s while retaining contact details',
  (role) => {
    mockRole = role;
    render(<AccountInfoScreen />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('account@example.invalid')).toBeTruthy();
    expect(screen.queryByText('Account')).toBeNull();
    expect(screen.queryByText('Role')).toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
  },
);
