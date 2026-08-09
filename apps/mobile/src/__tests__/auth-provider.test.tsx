import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { AnalyticsEvent } from '@iconicedu/utils';

// Mock Supabase client
const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
});
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: null },
  error: null,
});
const mockOnAuthStateChange = jest.fn().mockReturnValue({
  data: { subscription: { unsubscribe: jest.fn() } },
});
const mockSignInWithOtp = jest.fn().mockResolvedValue({ error: null });
const mockSignInWithOAuth = jest.fn().mockResolvedValue({
  data: { url: 'https://auth.example.test/oauth' },
  error: null,
});
const mockVerifyOtp = jest.fn().mockResolvedValue({
  data: { session: null, user: null },
  error: null,
});
const mockSetSession = jest.fn().mockResolvedValue({ error: null });
const mockSignOut = jest.fn().mockResolvedValue({});
const mockOpenAuthSessionAsync = jest.fn().mockResolvedValue({
  type: 'success',
  url: 'iconicedu://auth-callback#access_token=access-token&refresh_token=refresh-token',
});
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockActivateAccount = jest.fn().mockResolvedValue(undefined);
const mockFetchUserAccount = jest.fn().mockResolvedValue({ org_id: 'org-1' });
const mockCapture = jest.fn();
let appStateChangeListener: ((state: AppStateStatus) => void) | null = null;
const mockAnalyticsClient = {
  identify: jest.fn(),
  capture: mockCapture,
  reset: jest.fn(),
  flush: jest.fn(),
};

jest.mock('@/lib/api/queries', () => ({
  activateAccount: () => mockActivateAccount(),
  fetchUserAccount: () => mockFetchUserAccount(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock('@/providers/analytics-provider', () => ({
  useAnalytics: () => mockAnalyticsClient,
}));

jest.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      onAuthStateChange: (cb: unknown) => mockOnAuthStateChange(cb),
      signInWithOtp: (params: unknown) => mockSignInWithOtp(params),
      signInWithOAuth: (params: unknown) => mockSignInWithOAuth(params),
      verifyOtp: (params: unknown) => mockVerifyOtp(params),
      setSession: (params: unknown) => mockSetSession(params),
      signOut: (params?: unknown) => mockSignOut(params),
    },
    from: (table: unknown) => mockFrom(table),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateChangeListener = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, listener: (state: AppStateStatus) => void) => {
        appStateChangeListener = listener;
        return { remove: jest.fn() };
      });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockVerifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockFetchUserAccount.mockResolvedValue({ org_id: 'org-1' });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'iconicedu://auth-callback#access_token=access-token&refresh_token=refresh-token',
    });
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
      await result.current.signInWithOtp('iconicedudev+test@gmail.com');
    });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'iconicedudev+test@gmail.com',
      options: { shouldCreateUser: false },
    });
  });

  it('passes a CAPTCHA token when requesting an OTP', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signInWithOtp(
        'iconicedudev+test@gmail.com',
        'turnstile-token',
      );
    });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'iconicedudev+test@gmail.com',
      options: {
        shouldCreateUser: false,
        captchaToken: 'turnstile-token',
      },
    });
  });

  it('verifyOtp calls supabase', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.verifyOtp('iconicedudev+test@gmail.com', '123456');
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'iconicedudev+test@gmail.com',
      token: '123456',
      type: 'email',
    });
    expect(mockActivateAccount).toHaveBeenCalled();
  });

  it('signInWithApple starts Supabase OAuth through the in-app auth session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response: { error: string | null } = { error: 'not-called' };
    await act(async () => {
      response = await result.current.signInWithApple();
    });

    expect(response.error).toBeNull();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo: 'iconicedu://auth-callback',
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://auth.example.test/oauth',
      'iconicedu://auth-callback',
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('lets OAuth users without a linked account continue into onboarding', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } },
      error: null,
    });
    mockFetchUserAccount.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response: { error: string | null } = { error: null };
    await act(async () => {
      response = await result.current.signInWithGoogle();
    });

    expect(response.error).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockActivateAccount).not.toHaveBeenCalled();
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
      response = await result.current.signInWithOtp('iconicedudev+test@gmail.com');
    });

    expect(response.error).toBe('Rate limit exceeded');
  });

  it('signs out on app return after the incomplete onboarding threshold', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } } },
    });
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setOnboardingCompletionStatus(false);
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    act(() => {
      appStateChangeListener?.('background');
    });
    nowSpy.mockReturnValue(1000 + 15 * 60 * 1000);
    await act(async () => {
      appStateChangeListener?.('active');
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockCapture).toHaveBeenCalledWith(
      AnalyticsEvent.INCOMPLETE_ONBOARDING_REAUTH_TRIGGERED,
      expect.objectContaining({ source: 'mobile-appstate-return' }),
    );
    nowSpy.mockRestore();
  });

  it('does not sign out on app return under the incomplete onboarding threshold', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } } },
    });
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setOnboardingCompletionStatus(false);
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    act(() => {
      appStateChangeListener?.('background');
    });
    nowSpy.mockReturnValue(1000 + 60_000);
    await act(async () => {
      appStateChangeListener?.('active');
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('does not sign out completed users on app return', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } } },
    });
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setOnboardingCompletionStatus(true);
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    act(() => {
      appStateChangeListener?.('background');
    });
    nowSpy.mockReturnValue(1000 + 15 * 60 * 1000 + 1);
    await act(async () => {
      appStateChangeListener?.('active');
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('clears a cached session when Supabase Auth no longer recognizes it', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1', email: 'iconicedudev+test@gmail.com' } } },
    });
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Auth session missing!' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
