import type { AnnotationContext } from '@iconicedu/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { VideoAspect, ZoomVideoSdkUser, useZoom } from '@zoom/react-native-videosdk';
import { AnnotationCoordinateService } from '@iconicedu/utils';
import { NativeVideoView } from './native-video-view';
import { NativeScreenAnnotations } from './native-screen-annotations';
export function NativeShareStage({
  sessionId,
  userId,
  token,
  height,
  annotating,
  onToggleAnnotation,
  composited,
  publishAnnotations = true,
  onContext,
}: {
  sessionId: string;
  userId: string;
  token?: string;
  height: number;
  annotating: boolean;
  onToggleAnnotation?: () => void;
  composited: boolean;
  publishAnnotations?: boolean;
  onContext?: (shareKey: string, context: AnnotationContext) => void;
}) {
  const zoom = useZoom();
  const [viewport, setViewport] = useState({ width: 0, height });
  const [publishing, setPublishing] = useState(false);
  const [source, setSource] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let mounted = true;
    setSource({ width: 0, height: 0 });
    const refresh = async () => {
      try {
        const self = await zoom.session.getMySelf();
        if (mounted) setPublishing(self.userId === userId);
        const users = [self, ...(await zoom.session.getRemoteUsers())];
        const user = users.find((value) => value.userId === userId);
        if (!user) return;
        const statistics = new ZoomVideoSdkUser(user).shareStatisticInfo;
        // SDK 2.6.1 declares these NSNumber-backed values as booleans; normalize at its boundary.
        const width = Number(await statistics.getWidth()),
          height = Number(await statistics.getHeight());
        if (mounted && width > 0 && height > 0) setSource({ width, height });
      } catch {
        /* The share dimensions become available after its first received frame. */
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [zoom.session, userId]);
  const bounds = useMemo(
    () => new AnnotationCoordinateService(source).getContentBounds(viewport),
    [source, viewport],
  );
  return (
    <View
      testID="classroom-shared-screen"
      style={{ height }}
      onLayout={(event) => setViewport(event.nativeEvent.layout)}
    >
      <NativeVideoView
        userId={userId}
        sharing
        videoAspect={VideoAspect.LetterBox}
        style={{ flex: 1 }}
      />
      {bounds.width > 0 && (
        <View
          style={{
            position: 'absolute',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
          }}
        >
          <NativeScreenAnnotations
            key={`${sessionId}:${userId}`}
            onContext={onContext ? (context) => onContext(userId, context) : undefined}
            sessionId={sessionId}
            shareKey={userId}
            token={token}
            width={bounds.width}
            height={bounds.height}
            active={annotating}
            onToggle={onToggleAnnotation}
            composited={composited && !publishing}
            publishing={publishing && publishAnnotations}
          />
        </View>
      )}
    </View>
  );
}
