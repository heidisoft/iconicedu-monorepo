import { requireOptionalNativeModule } from 'expo';
/** A development-client overlay must not intercept classroom canvas test gestures. */
export async function prepareClassroomFixture() {
  if (!__DEV__) return;
  const preferences = requireOptionalNativeModule<{
    setPreferencesAsync(value: { showFloatingActionButton: boolean }): Promise<void>;
  }>('DevMenuPreferences');
  await preferences?.setPreferencesAsync({ showFloatingActionButton: false });
}
