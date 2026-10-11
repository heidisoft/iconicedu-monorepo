'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LocalVideoTrack, VideoPlayer } from '@zoom/videosdk';
import type { BackgroundPreset } from './zoom-video/zoom-video-session.types';
import { backgroundImageUrl } from './meeting-media-preferences';

/** Zoom's native local preview provides the same person segmentation as the call. */
export function usePreviewVideoEffects(surface: RefObject<HTMLDivElement | null>) {
  const track = useRef<LocalVideoTrack | null>(null);
  const initialization = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void track.current?.stop().catch(() => undefined);
      track.current = null;
    };
  }, []);
  const stop = async () => {
    const previous = track.current;
    track.current = null;
    if (previous) await previous.stop().catch(() => undefined);
    surface.current?.replaceChildren();
    if (mounted.current) setActive(false);
  };
  const start = async (cameraId: string | undefined, preset: BackgroundPreset) => {
    await stop();
    const { default: sdk } = await import('@zoom/videosdk');
    const { isZoomExecutedFailure, acquireZoomClient } =
      await import('@iconicedu/web/lib/live-sessions/zoom-session-lifecycle');
    if (!initialization.current) {
      initialization.current = (async () => {
        const result = await acquireZoomClient().init('en-US', 'Global', {
          patchJsMedia: true,
          enforceVirtualBackground: true,
        });
        if (result instanceof Error || isZoomExecutedFailure(result)) throw result;
      })().catch((error) => {
        initialization.current = null;
        throw error;
      });
    }
    await initialization.current;
    if (!mounted.current || !surface.current) return false;
    // Zoom recommends video-player for native preview, including WebRTC browsers.
    const container = document.createElement('video-player-container');
    const player = document.createElement('video-player') as VideoPlayer;
    container.style.cssText = 'display:block;width:100%;height:100%';
    player.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
    container.appendChild(player);
    surface.current.replaceChildren(container);
    const local = sdk.createLocalVideoTrack(cameraId);
    track.current = local;
    const imageUrl = backgroundImageUrl(preset);
    try {
      const result = await local.start(
        player,
        imageUrl ? { imageUrl, cropped: true } : undefined,
      );
      if (result instanceof Error || isZoomExecutedFailure(result)) throw result;
      if (!mounted.current) {
        await local.stop().catch(() => undefined);
        return false;
      }
      setActive(true);
      return true;
    } catch (error) {
      await local.stop().catch(() => undefined);
      if (track.current === local) track.current = null;
      throw error;
    }
  };
  const background = async (preset: BackgroundPreset) => {
    const { isZoomExecutedFailure } =
      await import('@iconicedu/web/lib/live-sessions/zoom-session-lifecycle');
    const result = await track.current?.updateVirtualBackground(
      backgroundImageUrl(preset),
      true,
    );
    if (result instanceof Error || isZoomExecutedFailure(result)) throw result;
  };
  const camera = async (id: string) => {
    const { isZoomExecutedFailure } =
      await import('@iconicedu/web/lib/live-sessions/zoom-session-lifecycle');
    const result = await track.current?.switchCamera(id);
    if (result instanceof Error || isZoomExecutedFailure(result)) throw result;
  };
  return { active, start, stop, background, camera };
}
