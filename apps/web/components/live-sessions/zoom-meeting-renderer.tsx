'use client';

import dynamic from 'next/dynamic';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';

/** The browser-only SDK is loaded only after device preview has completed. */
export const ZoomMeetingRenderer = dynamic(
  () =>
    import('./zoom-video-session-embed').then((module) => module.ZoomVideoSessionEmbed),
  { ssr: false, loading: () => <ZoomSessionLoadingScreen /> },
);
