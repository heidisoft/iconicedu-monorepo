import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { FlagsProvider, useFlag } from './feature-flags-provider';
import { mobileFlags } from '@/lib/flags';

// ─── Mock posthog-react-native ────────────────────────────────────────────────

const mockIsFeatureEnabled = jest.fn();
let capturedOnFeatureFlags: (() => void) | null = null;

jest.mock('posthog-react-native', () => ({
  usePostHog: () => ({
    isFeatureEnabled: mockIsFeatureEnabled,
    onFeatureFlags: (cb: () => void) => {
      capturedOnFeatureFlags = cb;
      // Return a noop unsubscribe
      return () => {
        capturedOnFeatureFlags = null;
      };
    },
  }),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

function FlagConsumer({ flagKey }: { flagKey: Parameters<typeof useFlag>[0] }) {
  const value = useFlag(flagKey);
  return <Text testID="flag-value">{String(value)}</Text>;
}

function renderWithFlags(flagKey: Parameters<typeof useFlag>[0]) {
  return render(
    <FlagsProvider>
      <FlagConsumer flagKey={flagKey} />
    </FlagsProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FlagsProvider / useFlag', () => {
  beforeEach(() => {
    mockIsFeatureEnabled.mockReset();
    capturedOnFeatureFlags = null;
  });

  it('returns defaultValue (false) when PostHog returns undefined', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('false');
  });

  it('returns true when PostHog returns true for the flag', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('true');
  });

  it('returns false when PostHog returns false for the flag', () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('false');
  });

  it('updates from false to true when onFeatureFlags fires after async load', () => {
    // Initially flags not loaded — isFeatureEnabled returns undefined → default false
    mockIsFeatureEnabled.mockReturnValue(undefined);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('false');

    // PostHog loads flags from network — now returns true
    mockIsFeatureEnabled.mockReturnValue(true);
    act(() => {
      capturedOnFeatureFlags?.();
    });

    expect(screen.getByTestId('flag-value').props.children).toBe('true');
  });

  it('default values in catalog match expected defaults', () => {
    expect(mobileFlags['enable-quick-access'].defaultValue).toBe(false);
  });
});
