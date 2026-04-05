import { renderHook } from '@testing-library/react-native';
import { useSupervisedDirectMessages } from './use-supervised-direct-messages';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchSupervisedDirectMessages: (...args) => mockFetch(...args),
  queryKeys: {
    supervisedDirectMessages: (orgId, accountId) => [
      'supervisedDirectMessages',
      orgId,
      accountId,
    ],
  },
}));

const fakeSupervisedChannel = {
  id: 'ch-sup-1',
  org_id: 'org-1',
  topic: null,
  description: null,
  kind: 'dm',
  updated_at: '2026-01-01T00:00:00Z',
  unread_count: 0,
  last_message_text: null,
  last_message_at: null,
  last_message_sender: null,
  is_supervised: true,
  supervised_child_name: 'Alice',
};

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('useSupervisedDirectMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(
      ({ queryFn, enabled }: { queryFn: () => unknown; enabled: boolean }) => {
        if (!enabled) {
          return {
            data: undefined,
            isLoading: false,
          };
        }

        return {
          data: queryFn(),
          isLoading: false,
        };
      },
    );
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHook(() =>
      useSupervisedDirectMessages('', 'acct-1', 'prof-1'),
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when guardianAccountId is empty', () => {
    const { result } = renderHook(() =>
      useSupervisedDirectMessages('org-1', '', 'prof-1'),
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when guardianProfileId is empty', () => {
    const { result } = renderHook(() =>
      useSupervisedDirectMessages('org-1', 'acct-1', ''),
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns supervised channels on success', () => {
    mockFetch.mockReturnValue([fakeSupervisedChannel]);

    const { result } = renderHook(() =>
      useSupervisedDirectMessages('org-1', 'acct-1', 'prof-1'),
    );

    expect(result.current.data).toEqual([fakeSupervisedChannel]);
  });

  it('calls fetch with correct arguments', () => {
    mockFetch.mockReturnValue([]);

    renderHook(() =>
      useSupervisedDirectMessages('org-1', 'acct-guardian', 'prof-guardian'),
    );

    expect(mockFetch).toHaveBeenCalledWith('org-1', 'acct-guardian', 'prof-guardian');
  });
});
