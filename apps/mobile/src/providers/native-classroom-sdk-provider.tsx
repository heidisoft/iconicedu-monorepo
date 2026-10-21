import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, NativeModules, View } from 'react-native';

// A single SDK instance survives route changes. Older binaries keep the browser flow.
const Provider = lazy(async () => {
  const { ZoomVideoSdkProvider } = await import('@zoom/react-native-videosdk');
  return {
    default: function NativeSdk({ children }: { children: React.ReactNode }) {
      return (
        <ZoomVideoSdkProvider
          config={{
            domain: 'zoom.us',
            enableLog: false,
            appGroupId: 'group.com.heidisoft.iconicedu.classroom',
          }}
        >
          <View collapsable={false} testID="native-sdk-ready" style={{ flex: 1 }}>
            {children}
          </View>
        </ZoomVideoSdkProvider>
      );
    },
  };
});
export function NativeClassroomSdkProvider({ children }: { children: React.ReactNode }) {
  if (!NativeModules.RNZoomVideoSdk) return <>{children}</>;
  return (
    <Suspense
      fallback={<ActivityIndicator accessibilityLabel="Preparing classroom media" />}
    >
      <Provider>{children}</Provider>
    </Suspense>
  );
}
