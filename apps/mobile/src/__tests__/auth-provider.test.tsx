import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

// Mock Supabase client
const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
});
const mockOnAuthStateChange = jest.fn().mockReturnValue({
  data: { subscription: { unsubscribe: jest.fn() } },
});
const mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
const mockVerifyOtp = jest.fn().mockResolvedValue({ error: null });
const mockSignOut = jest.fn().mockResolvedValue({});

jest.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: unknown) => mockOnAuthStateChange(cb),
      signInWithOtp: (params: unknown) => mockSignInWithOtp(params),
      verifyOtp: (params: unknown) => mockVerifyOtp(params),
      signOut: () => mockSignOut(),
    },
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in loading state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Initially loading is true, then resolves
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('has null session when not authenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('signInWithOtp calls supabase', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signInWithOtp('test@example.com');
    });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
    });
  });

  it('verifyOtp calls supabase', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.verifyOtp('test@example.com', '123456');
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('signOut calls supabase', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('returns error from signInWithOtp on failure', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({
      error: { message: 'Rate limit exceeded' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response: { error: string | null } = { error: null };
    await act(async () => {
      response = await result.current.signInWithOtp('test@example.com');
    });

    expect(response.error).toBe('Rate limit exceeded');
  });
});
