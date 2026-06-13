import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReleaseNotes } from '@/lib/release-notes';
import {
  useWhatsNewReleaseNotes,
  WHATS_NEW_LAST_SEEN_KEY,
} from './use-whats-new-release-notes';

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

const releaseNotes: ReleaseNotes = {
  id: 'release-1',
  title: "What's new",
  items: ['New message composer', 'Better class reminders'],
};

describe('useWhatsNewReleaseNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  it('shows when no stored release id exists', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { result } = renderHook(() => useWhatsNewReleaseNotes(releaseNotes));

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
    expect(mockGetItemAsync).toHaveBeenCalledWith(WHATS_NEW_LAST_SEEN_KEY);
  });

  it('does not show when the stored release id matches the current release', async () => {
    mockGetItemAsync.mockResolvedValue(releaseNotes.id);

    const { result } = renderHook(() => useWhatsNewReleaseNotes(releaseNotes));

    await waitFor(() => {
      expect(mockGetItemAsync).toHaveBeenCalledWith(WHATS_NEW_LAST_SEEN_KEY);
    });
    expect(result.current.shouldShow).toBe(false);
  });

  it('stores the release id on dismiss', async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { result } = renderHook(() => useWhatsNewReleaseNotes(releaseNotes));

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.shouldShow).toBe(false);
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      WHATS_NEW_LAST_SEEN_KEY,
      releaseNotes.id,
    );
  });

  it('tolerates SecureStore read errors by showing the release notes', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('read failed'));

    const { result } = renderHook(() => useWhatsNewReleaseNotes(releaseNotes));

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });
  });

  it('tolerates SecureStore write errors without throwing', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockRejectedValue(new Error('write failed'));

    const { result } = renderHook(() => useWhatsNewReleaseNotes(releaseNotes));

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });

    expect(() => {
      act(() => {
        result.current.dismiss();
      });
    }).not.toThrow();
    expect(result.current.shouldShow).toBe(false);
  });
});
