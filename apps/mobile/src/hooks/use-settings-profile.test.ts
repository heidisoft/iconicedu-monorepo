import { renderHook } from '@testing-library/react-native';
import { useSettingsProfile } from './use-settings-profile';
let mockParams: { profileId?: string } = {};
let mockSelected = {
  data: undefined as { profile: { id: string; display_name: string } } | undefined,
  isPending: true,
  isError: false,
  refetch: jest.fn(),
};
const mockCurrent = {
  data: { id: 'parent-profile', display_name: 'Parent' },
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => mockSelected }));
jest.mock('./use-profile', () => ({ useProfile: () => mockCurrent }));
jest.mock('@/lib/api/profile-settings', () => ({ fetchProfileSettings: jest.fn() }));
beforeEach(() => {
  mockParams = {};
  mockSelected = { data: undefined, isPending: true, isError: false, refetch: jest.fn() };
});
it('keeps existing settings tied to the current profile by default', () => {
  const { result } = renderHook(useSettingsProfile);
  expect(result.current.data).toBe(mockCurrent.data);
});
it('shows the explicitly selected child on the existing settings screen', () => {
  mockParams = { profileId: 'child-profile' };
  mockSelected = {
    data: { profile: { id: 'child-profile', display_name: 'Child' } },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  };
  const { result } = renderHook(useSettingsProfile);
  expect(result.current.data?.id).toBe('child-profile');
});
it.each([false, true])(
  'never falls back to parent data while the selected child is loading or denied (error: %s)',
  (isError) => {
    mockParams = { profileId: 'child-profile' };
    mockSelected.isError = isError;
    mockSelected.isPending = !isError;
    const { result } = renderHook(useSettingsProfile);
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(isError);
  },
);
