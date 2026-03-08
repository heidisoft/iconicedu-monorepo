import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupervisedDirectMessages } from './use-supervised-direct-messages';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // eslint-disable-next-line react/prop-types
  function TestWrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  const Wrapper = TestWrapper;
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

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
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHook(
      () => useSupervisedDirectMessages('', 'acct-1', 'prof-1'),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when guardianAccountId is empty', () => {
    const { result } = renderHook(
      () => useSupervisedDirectMessages('org-1', '', 'prof-1'),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when guardianProfileId is empty', () => {
    const { result } = renderHook(
      () => useSupervisedDirectMessages('org-1', 'acct-1', ''),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns supervised channels on success', async () => {
    mockFetch.mockResolvedValue([fakeSupervisedChannel]);

    const { result } = renderHook(
      () => useSupervisedDirectMessages('org-1', 'acct-1', 'prof-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([fakeSupervisedChannel]);
  });

  it('calls fetch with correct arguments', async () => {
    mockFetch.mockResolvedValue([]);

    renderHook(
      () => useSupervisedDirectMessages('org-1', 'acct-guardian', 'prof-guardian'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith('org-1', 'acct-guardian', 'prof-guardian');
  });
});
