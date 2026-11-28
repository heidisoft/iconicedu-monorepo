import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/** A page sheet has its own safe area; screen insets would add a second top gap. */
export function SheetContent({
  children,
  backgroundColor,
}: React.PropsWithChildren<{ backgroundColor: string }>) {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={{ flex: 1, backgroundColor, paddingTop: 24 }}
      >
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
