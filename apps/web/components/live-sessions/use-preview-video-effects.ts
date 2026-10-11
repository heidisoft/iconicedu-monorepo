'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LocalVideoTrack } from '@zoom/videosdk';
import type { BackgroundPreset } from './zoom-video/zoom-video-session.types';
import { backgroundImageUrl } from './meeting-media-preferences';

/** Zoom's native local preview provides the same person segmentation as the call. */
export function usePreviewVideoEffects(canvas: RefObject<HTMLCanvasElement | null>) {
  const track = useRef<LocalVideoTrack | null>(null);
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
    if (mounted.current) setActive(false);
  };
  const start = async (cameraId: string | undefined, preset: BackgroundPreset) => {
    await stop();
    const { default: sdk } = await import('@zoom/videosdk');
    if (!mounted.current || !canvas.current) return false;
    const local = sdk.createLocalVideoTrack(cameraId);
    track.current = local;
    const imageUrl = backgroundImageUrl(preset);
    try {
      const result = await local.start(
        canvas.current,
        imageUrl ? { imageUrl, cropped: true } : undefined,
      );
      if (result instanceof Error) throw result;
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
    const result = await track.current?.updateVirtualBackground(
      backgroundImageUrl(preset),
      true,
    );
    if (result instanceof Error) throw result;
  };
  const camera = async (id: string) => {
    const result = await track.current?.switchCamera(id);
    if (result instanceof Error) throw result;
  };
  return { active, start, stop, background, camera };
}
