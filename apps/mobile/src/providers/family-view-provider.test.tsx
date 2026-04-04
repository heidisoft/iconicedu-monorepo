import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseAuth = jest.fn();
const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
const mockFetchUserAccount = jest.fn();
const mockFetchProfilesForAccount = jest.fn();
const mockFetchFamilyLinks = jest.fn();
const mockFetchProfilesByAccountIds = jest.fn();
const mockFetchAccountsByIds = jest.fn();
const mockFetchProfileByAccountId = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchUserAccount: (...args: unknown[]) => mockFetchUserAccount(...args),
  fetchProfilesForAccount: (...args: unknown[]) => mockFetchProfilesForAccount(...args),
  fetchFamilyLinks: (...args: unknown[]) => mockFetchFamilyLinks(...args),
  fetchProfilesByAccountIds: (...args: unknown[]) =>
    mockFetchProfilesByAccountIds(...args),
  fetchAccountsByIds: (...args: unknown[]) => mockFetchAccountsByIds(...args),
  fetchProfileByAccountId: (...args: unknown[]) => mockFetchProfileByAccountId(...args),
}));

import { FamilyViewProvider, useFamilyView } from './family-view-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';

function Consumer() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { familySwitchOptions, isViewingAsChild, switchFamilyView } = useFamilyView();

  return (
    <>
      <Text testID="account-id">{String(account?.id ?? '')}</Text>
      <Text testID="profile-id">{String(profile?.id ?? '')}</Text>
      <Text testID="is-viewing-as-child">{String(isViewingAsChild)}</Text>
      <Text testID="option-count">{String(familySwitchOptions.length)}</Text>
      <TouchableOpacity
        testID="switch-child"
        onPress={() => void switchFamilyView('child-profile')}
      >
        <Text>switch</Text>
      </TouchableOpacity>
    </>
  );
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyViewProvider>
        <Consumer />
      </FamilyViewProvider>
    </QueryClientProvider>,
  );
}

describe('FamilyViewProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'auth-user-1', email: 'iconicedudev+parent@gmail.com' },
    });
    mockFetchUserAccount.mockResolvedValue({
      id: 'guardian-account',
      org_id: 'org-1',
      active_profile_id: 'guardian-profile',
      primary_role: 'guardian',
    });
    mockFetchProfilesForAccount.mockResolvedValue([
      {
        id: 'guardian-profile',
        account_id: 'guardian-account',
        org_id: 'org-1',
        kind: 'guardian',
        display_name: 'Parent One',
        status: 'active',
      },
    ]);
    mockFetchFamilyLinks.mockResolvedValue([{ child_account_id: 'child-account' }]);
    mockFetchProfilesByAccountIds.mockResolvedValue([
      {
        id: 'child-profile',
        account_id: 'child-account',
        org_id: 'org-1',
        kind: 'child',
        display_name: 'Child One',
        status: 'active',
      },
    ]);
    mockFetchAccountsByIds.mockResolvedValue([
      {
        id: 'child-account',
        org_id: 'org-1',
        active_profile_id: 'child-profile',
        primary_role: 'child',
      },
    ]);
    mockFetchProfileByAccountId.mockImplementation(async (accountId: string) => {
      if (accountId === 'child-account') {
        return {
          id: 'child-profile',
          account_id: 'child-account',
          org_id: 'org-1',
          kind: 'child',
          display_name: 'Child One',
        };
      }

      return {
        id: 'guardian-profile',
        account_id: 'guardian-account',
        org_id: 'org-1',
        kind: 'guardian',
        display_name: 'Parent One',
      };
    });
    mockSetItemAsync.mockResolvedValue(undefined);
    mockDeleteItemAsync.mockResolvedValue(undefined);
  });

  it('restores parent mode by default and switches to a linked child', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('account-id').props.children).toBe('guardian-account');
      expect(screen.getByTestId('profile-id').props.children).toBe('guardian-profile');
      expect(screen.getByTestId('option-count').props.children).toBe('2');
    });

    fireEvent.press(screen.getByTestId('switch-child'));

    await waitFor(() => {
      expect(screen.getByTestId('account-id').props.children).toBe('child-account');
      expect(screen.getByTestId('profile-id').props.children).toBe('child-profile');
      expect(screen.getByTestId('is-viewing-as-child').props.children).toBe('true');
    });

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'mobile_family_view_selection',
      JSON.stringify({
        orgId: 'org-1',
        guardianAccountId: 'guardian-account',
        childProfileId: 'child-profile',
      }),
    );
  });

  it('clears an invalid stored child selection', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        orgId: 'org-1',
        guardianAccountId: 'guardian-account',
        childProfileId: 'missing-child-profile',
      }),
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('account-id').props.children).toBe('guardian-account');
      expect(screen.getByTestId('profile-id').props.children).toBe('guardian-profile');
      expect(screen.getByTestId('is-viewing-as-child').props.children).toBe('false');
    });

    await waitFor(() => {
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('mobile_family_view_selection');
    });
  });
});
