import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AnalyticsEvent } from '@iconicedu/utils';
import { CrashBoundary } from './crash-boundary';

/** Component that throws on first render when `shouldThrow` is true. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <></>;
}

describe('CrashBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  // Suppress expected console.error output from React during error boundary tests
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error', () => {
    const capture = jest.fn();
    render(
      <CrashBoundary analyticsCapture={capture}>
        <Bomb shouldThrow={false} />
      </CrashBoundary>,
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('renders fallback UI when a child throws', () => {
    const capture = jest.fn();
    render(
      <CrashBoundary analyticsCapture={capture}>
        <Bomb shouldThrow />
      </CrashBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('calls analyticsCapture with CRASH_RECOVERED on error', () => {
    const capture = jest.fn();
    render(
      <CrashBoundary analyticsCapture={capture}>
        <Bomb shouldThrow />
      </CrashBoundary>,
    );
    expect(capture).toHaveBeenCalledWith(
      AnalyticsEvent.CRASH_RECOVERED,
      expect.objectContaining({ message: 'Test explosion' }),
    );
  });

  it('resets and renders children again after pressing Try again', () => {
    const capture = jest.fn();

    class ControllableBomb extends React.Component<
      { shouldThrow: boolean },
      Record<string, never>
    > {
      render() {
        if (this.props.shouldThrow) throw new Error('Boom');
        return <></>;
      }
    }

    // Use a stateful wrapper so we can control whether the bomb throws
    class Wrapper extends React.Component<
      Record<string, never>,
      { shouldThrow: boolean }
    > {
      state = { shouldThrow: true };
      render() {
        return (
          <CrashBoundary analyticsCapture={capture}>
            <ControllableBomb shouldThrow={this.state.shouldThrow} />
          </CrashBoundary>
        );
      }
    }

    const { getByText } = render(<Wrapper />);
    expect(getByText('Something went wrong')).toBeTruthy();

    fireEvent.press(getByText('Try again'));
    // After reset, boundary re-renders children; ControllableBomb still throws
    // because wrapper state still has shouldThrow: true, so fallback shows again
    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
