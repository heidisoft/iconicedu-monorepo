import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FlagsProvider, useFlag } from './feature-flags-provider';
import { mobileFlags } from '@/lib/flags';

// ─── Mock posthog-react-native ────────────────────────────────────────────────

const mockUseFeatureFlag = jest.fn();

jest.mock('posthog-react-native', () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
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
    mockUseFeatureFlag.mockReset();
  });

  it('returns defaultValue (false) when PostHog returns undefined (not loaded yet)', () => {
    mockUseFeatureFlag.mockReturnValue(undefined);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('false');
  });

  it('returns true when PostHog returns true for the flag', () => {
    mockUseFeatureFlag.mockReturnValue(true);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('true');
  });

  it('returns false when PostHog returns false for the flag', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    renderWithFlags('enable-quick-access');
    expect(screen.getByTestId('flag-value').props.children).toBe('false');
  });

  it('passes the correct flag key to useFeatureFlag', () => {
    mockUseFeatureFlag.mockReturnValue(undefined);
    renderWithFlags('enable-quick-access');
    expect(mockUseFeatureFlag).toHaveBeenCalledWith('enable-quick-access');
  });

  it('default values in catalog match expected defaults', () => {
    expect(mobileFlags['enable-quick-access'].defaultValue).toBe(false);
  });
});
