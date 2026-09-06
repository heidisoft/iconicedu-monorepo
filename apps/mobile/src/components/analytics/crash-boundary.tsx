import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AnalyticsEvent, type AnalyticsClient } from '@iconicedu/utils';
import { lightColors, type AppColors } from '@/lib/theme';

type Props = {
  /** analytics.capture from useAnalytics() — passed as a prop to avoid context in class. */
  analyticsCapture: AnalyticsClient['capture'];
  colors?: AppColors;
  children: React.ReactNode;
};

type State = { crashed: boolean };

/**
 * React error boundary that catches render-time JS errors, reports them via
 * analytics, and shows a friendly fallback UI with a retry button.
 *
 * Wire it inside AnalyticsProvider so `analyticsCapture` is always live.
 * Use the `CrashBoundaryWrapper` convenience component from app-providers.tsx.
 */
export class CrashBoundary extends React.Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.analyticsCapture(AnalyticsEvent.CRASH_RECOVERED, {
      message: error.message,
      componentStack: info.componentStack ?? undefined,
    });
  }

  private handleReset = () => {
    this.setState({ crashed: false });
  };

  render() {
    if (this.state.crashed) {
      const colors = this.props.colors ?? lightColors;
      return (
        <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
          <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            The app ran into an unexpected error. Please try again.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.action }]}
            onPress={this.handleReset}
          >
            <Text style={[styles.buttonText, { color: colors.actionForeground }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
