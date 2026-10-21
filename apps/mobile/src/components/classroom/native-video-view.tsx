import React from 'react';
import { Platform, requireNativeComponent } from 'react-native';
import { ZoomView } from '@zoom/react-native-videosdk';
type Props = React.ComponentProps<typeof ZoomView>;
const AndroidVideoView =
  Platform.OS === 'android' ? requireNativeComponent<Props>('ClassroomVideoView') : null;
/** Android subscriptions are per view; iOS uses Zoom's per-instance canvas implementation. */
export function NativeVideoView(props: Props) {
  return AndroidVideoView ? <AndroidVideoView {...props} /> : <ZoomView {...props} />;
}
